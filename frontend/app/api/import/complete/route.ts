import { createReadStream } from 'node:fs'
import { stat, unlink } from 'node:fs/promises'
import http from 'node:http'
import https from 'node:https'
import { join } from 'node:path'
import FormData from 'form-data'
import { type NextRequest, NextResponse } from 'next/server'
import { isSameOriginMutation, sameOriginError } from '@/lib/same-origin'
import { getVirtuosoConfig } from '@/providers/virtuoso/config'
import { getSessionFromRequest } from '@/providers/virtuoso/request-auth'

const UPLOADS_DIR = join(process.cwd(), 'uploads')
const UPLOAD_TIMEOUT_MS = 10 * 60 * 1000 // 10 minutes timeout for large files

/**
 * After chunks are uploaded, this endpoint forwards the complete file
 * to the Virtuoso adapter using streaming to support large files.
 */
export async function POST(req: NextRequest) {
  if (!isSameOriginMutation(req)) return sameOriginError()
  const adapterUrl = getVirtuosoConfig().VIRTUOSO_ADAPTER_URL
  const session = await getSessionFromRequest(req)
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  let filename = ''

  try {
    const body = await req.json()
    filename = body.filename

    if (!filename || typeof filename !== 'string') {
      return NextResponse.json(
        { error: 'Filename is required' },
        { status: 400 }
      )
    }

    const filePath = join(UPLOADS_DIR, filename)

    // Check if file exists
    try {
      await stat(filePath)
    } catch {
      return NextResponse.json(
        { error: `File not found: ${filename}` },
        { status: 404 }
      )
    }

    // Stream the file using form-data package which properly handles large files
    const formData = new FormData()
    const fileStream = createReadStream(filePath)
    formData.append('file', fileStream, { filename })

    // Upload using streaming with http/https modules
    const url = new URL(adapterUrl)
    const isHttps = url.protocol === 'https:'
    const httpModule = isHttps ? https : http

    const uploadResult = await new Promise<{ status: number; data: string }>(
      (resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Upload timeout after ${UPLOAD_TIMEOUT_MS}ms`))
        }, UPLOAD_TIMEOUT_MS)

        const options = {
          hostname: url.hostname,
          port: url.port || (isHttps ? 443 : 80),
          path: '/api/import/upload',
          method: 'POST',
          headers: {
            ...formData.getHeaders(),
            Authorization: `Bearer ${session.token}`
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

    // Clean up the temporary file
    try {
      await unlink(filePath)
    } catch (unlinkError) {
      console.error('Failed to delete temporary file:', unlinkError)
      // Don't fail the request if cleanup fails
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
        // If response is not JSON, use raw data
        errorData = { error: uploadResult.data }
      }
      return NextResponse.json(
        { error: errorData.error || 'Failed to upload file' },
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

    // Clean up file on error if we have a filename
    if (filename) {
      try {
        await unlink(join(UPLOADS_DIR, filename))
      } catch {
        // Ignore cleanup errors
      }
    }

    // In development, return detailed error information
    const isDevelopment = process.env.NODE_ENV === 'development'
    const errorResponse = isDevelopment
      ? {
          error: err.message || 'An unknown error occurred',
          stack: err.stack,
          name: err.name
        }
      : { error: err.message || 'An unknown error occurred' }

    return NextResponse.json(errorResponse, { status: 500 })
  }
}
