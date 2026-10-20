import { createReadStream } from 'node:fs'
import { stat, unlink } from 'node:fs/promises'
import http from 'node:http'
import https from 'node:https'
import { basename } from 'node:path'
import FormData from 'form-data'
import { after, type NextRequest, NextResponse } from 'next/server'
import { requirePrincipal } from '@/lib/api-auth'
import { isSameOriginMutation, sameOriginError } from '@/lib/same-origin'
import { cleanStaleUploads } from '@/lib/upload-cleanup'
import { stagedUploadPath } from '@/lib/upload-paths'
import { getVirtuosoConfig } from '@/providers/virtuoso/config'

const UPLOAD_TIMEOUT_MS = 10 * 60 * 1000

/**
 * After chunks are uploaded, this endpoint forwards the complete file
 * to the Virtuoso adapter using streaming to support large files.
 */
export async function POST(req: NextRequest) {
  if (!isSameOriginMutation(req)) return sameOriginError()

  const auth = await requirePrincipal()
  if (auth.response) return auth.response

  after(async () => {
    await cleanStaleUploads()
  })

  const adapterUrl = getVirtuosoConfig().VIRTUOSO_ADAPTER_URL

  let filename = ''

  try {
    const body = await req.json()
    filename = body.filename

    if (!filename || typeof filename !== 'string') {
      return NextResponse.json(
        { error: 'Filename is required.' },
        { status: 400 }
      )
    }

    let filePath: string
    try {
      filePath = stagedUploadPath(auth.principal.id, filename)
    } catch {
      return NextResponse.json(
        { error: "That filename can't be used." },
        { status: 400 }
      )
    }

    try {
      await stat(filePath)
    } catch {
      return NextResponse.json(
        { error: "Couldn't find the uploaded file. Try uploading it again." },
        { status: 404 }
      )
    }

    const formData = new FormData()
    const fileStream = createReadStream(filePath)
    formData.append('file', fileStream, {
      filename: basename(filename).replace(/[\r\n]/g, '')
    })

    const url = new URL(adapterUrl)
    const isHttps = url.protocol === 'https:'
    const httpModule = isHttps ? https : http

    const uploadResult = await new Promise<{ status: number; data: string }>(
      (resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('The upload timed out. Try again.'))
        }, UPLOAD_TIMEOUT_MS)

        const options = {
          hostname: url.hostname,
          port: url.port || (isHttps ? 443 : 80),
          path: '/api/import/upload',
          method: 'POST',
          headers: {
            ...formData.getHeaders(),
            'X-Adapter-Token': getVirtuosoConfig().VIRTUOSO_ADAPTER_TOKEN
          }
        }

        const uploadReq = httpModule.request(options, (res) => {
          let data = ''

          res.on('data', (chunk) => {
            data += chunk
          })

          res.on('end', () => {
            clearTimeout(timeout)
            resolve({ status: res.statusCode || 500, data })
          })

          res.on('error', (error) => {
            clearTimeout(timeout)
            reject(error)
          })
        })

        uploadReq.on('error', (error) => {
          clearTimeout(timeout)
          reject(error)
        })

        formData.pipe(uploadReq)
      }
    )

    try {
      await unlink(filePath)
    } catch (unlinkError) {
      console.error('Failed to delete temporary file:', unlinkError)
    }

    if (uploadResult.status < 200 || uploadResult.status >= 300) {
      console.error(
        'Upload failed with status:',
        uploadResult.status,
        'data:',
        uploadResult.data
      )
      let errorData: { error?: string } = {}
      try {
        errorData = JSON.parse(uploadResult.data)
      } catch {
        errorData = { error: uploadResult.data }
      }
      return NextResponse.json(
        { error: errorData.error || "Couldn't upload the file." },
        { status: uploadResult.status }
      )
    }

    let data: unknown
    try {
      data = JSON.parse(uploadResult.data)
    } catch {
      data = { message: 'Upload successful' }
    }

    return NextResponse.json(data)
  } catch (error: unknown) {
    const err = error as Error
    console.error('Error in /api/import/complete:', err)

    if (filename) {
      try {
        await unlink(stagedUploadPath(auth.principal.id, filename))
      } catch {}
    }

    const isDevelopment = process.env.NODE_ENV === 'development'
    const errorResponse = isDevelopment
      ? {
          error: err.message || "Couldn't upload the file.",
          stack: err.stack,
          name: err.name
        }
      : { error: err.message || "Couldn't upload the file." }

    return NextResponse.json(errorResponse, { status: 500 })
  }
}
