import path from 'node:path'
import { IMPORTS_PATH } from './config'
import { getConnection } from './database'
import { logger } from './logger'
import type { VirtuosoSession } from './session-manager'
import type { BulkLoadJobStatus, CpuCountResult, LoadListRow } from './types'

function userImportDir(userId: string): string {
  return path.join(IMPORTS_PATH, userId)
}

function scopedFilePattern(userId: string, filename: string): string {
  return `%/${userId}/${filename}`
}

function buildJobId(userId: string, filename: string, graphIri: string): string {
  return `${userId}|${filename}|${graphIri}`
}

function parseJobId(
  jobId: string
): { userId: string; filename: string; graphIri: string } | null {
  const [userId, filename, ...rest] = jobId.split('|')
  const graphIri = rest.join('|')
  if (!userId || !filename || !graphIri) return null
  return { userId, filename, graphIri }
}

/**
 * Maps Virtuoso LOAD_LIST state codes to human-readable status strings.
 * Based on Virtuoso documentation: 0=scheduled, 1=loading, 2=completed, 3=failed.
 * Reference: https://vos.openlinksw.com/owiki/wiki/VOS/VirtBulkRDFLoader#Bulk%20loading%20process
 * @param state Numeric state from LOAD_LIST.ll_state
 * @param error Error message if any
 * @returns Status string: 'queued', 'in-progress', 'completed', or 'failed'
 */
export function mapStateToStatus(
  state: number,
  error: string | null
): 'queued' | 'in-progress' | 'completed' | 'failed' {
  if (error) return 'failed'

  switch (state) {
    case 0:
      return 'queued'
    case 1:
      return 'in-progress'
    case 2:
      return 'completed'
    case 3:
      return 'failed'
    default:
      return 'queued'
  }
}

/**
 * Registers a file for bulk loading into Virtuoso.
 * Files are scoped to the submitting user so identical filenames from
 * different users do not clobber each other.
 * @param filename Name of the file in the user's imports directory
 * @param graphIri Target graph IRI
 * @returns Job ID
 */
export async function registerBulkLoadJob(
  session: VirtuosoSession,
  filename: string,
  graphIri: string
): Promise<string> {
  const connection = await getConnection(session)
  const filePattern = scopedFilePattern(session.userId, filename)

  // Virtuoso won't process duplicate entries in LOAD_LIST, so remove any
  // existing job for this user's file and graph.
  // Virtuoso stores absolute paths in LOAD_LIST, so we match by suffix to
  // cover local and remote paths.
  const existingJob = await connection.query(
    `SELECT ll_file, ll_graph FROM DB.DBA.LOAD_LIST WHERE ll_file LIKE '${filePattern}'`
  )
  if (existingJob.length > 0) {
    logger.info('File already registered in LOAD_LIST, removing existing job', {
      filename,
      graphIri
    })
    await connection.query(
      `DELETE FROM DB.DBA.LOAD_LIST WHERE ll_file LIKE '${filePattern}'`
    )
  }

  // Register file for loading using the user-scoped directory
  logger.info('Registering file for bulk load', {
    filename,
    graphIri,
    path: userImportDir(session.userId)
  })
  // ld_dir registers files for the RDF bulk loader. Docs: https://docs.openlinksw.com/virtuoso/rdfperstrload/#rdfperstrloadbulk
  await connection.query(
    `ld_dir('${userImportDir(session.userId)}', '${filename}', '${graphIri}')`
  )
  await connection.close()

  const jobId = buildJobId(session.userId, filename, graphIri)
  logger.info('Bulk load job created', { jobId, filename, graphIri })

  return jobId
}

/**
 * Gets the status of a bulk load job.
 * @param jobId Job identifier in format "userId|filename|graphIri"
 * @returns Job status details
 */
export async function getBulkLoadJobStatus(
  session: VirtuosoSession,
  jobId: string
): Promise<BulkLoadJobStatus> {
  const parsed = parseJobId(jobId)

  if (!parsed || parsed.userId !== session.userId) {
    throw new Error('Invalid job ID')
  }

  const connection = await getConnection(session)

  // Query the LOAD_LIST table for this job
  const query = `
    SELECT
      ll_file, ll_graph, ll_state, ll_started, ll_done,
      ll_host, ll_work_time, ll_error
    FROM DB.DBA.LOAD_LIST
    WHERE ll_file LIKE '${scopedFilePattern(parsed.userId, parsed.filename)}' AND ll_graph = '${parsed.graphIri}'
  `

  const result = await connection.query(query)
  await connection.close()

  if (result.length === 0) {
    throw new Error(`No bulk load job found with ID ${jobId}`)
  }

  const job = result[0] as LoadListRow
  const jobStatus: BulkLoadJobStatus = {
    filename: job.ll_file,
    graphIri: job.ll_graph,
    state: job.ll_state,
    status: mapStateToStatus(job.ll_state, job.ll_error),
    started: job.ll_started,
    done: job.ll_done,
    host: job.ll_host,
    workTime: job.ll_work_time,
    error: job.ll_error
  }

  return jobStatus
}

/**
 * Gets the bulk load jobs belonging to the given user.
 * @returns Array of job statuses
 */
export async function getAllBulkLoadJobs(
  session: VirtuosoSession
): Promise<BulkLoadJobStatus[]> {
  const connection = await getConnection(session)

  // Query only this user's jobs from the LOAD_LIST table
  const result = await connection.query(`
    SELECT
      ll_file, ll_graph, ll_state, ll_started, ll_done,
      ll_host, ll_work_time, ll_error
    FROM DB.DBA.LOAD_LIST
    WHERE ll_file LIKE '%/${session.userId}/%'
  `)
  await connection.close()

  const jobs = (result as LoadListRow[]).map((job) => ({
    filename: job.ll_file,
    graphIri: job.ll_graph,
    state: job.ll_state,
    status: mapStateToStatus(job.ll_state, job.ll_error),
    started: job.ll_started,
    done: job.ll_done,
    host: job.ll_host,
    workTime: job.ll_work_time,
    error: job.ll_error,
    jobId: buildJobId(
      session.userId,
      path.basename(job.ll_file),
      job.ll_graph
    )
  }))

  return jobs
}

/**
 * Cancels a running or queued bulk load job.
 * @param jobId Job identifier in format "userId|filename|graphIri"
 */
export async function cancelBulkLoadJob(
  session: VirtuosoSession,
  jobId: string
): Promise<void> {
  const parsed = parseJobId(jobId)

  if (!parsed || parsed.userId !== session.userId) {
    throw new Error('Invalid job ID')
  }

  const connection = await getConnection(session)

  // Query the current job state
  const jobResult = await connection.query(`
    SELECT ll_state, ll_error
    FROM DB.DBA.LOAD_LIST
    WHERE ll_file LIKE '${scopedFilePattern(parsed.userId, parsed.filename)}' AND ll_graph = '${parsed.graphIri}'
  `)

  if (jobResult.length === 0) {
    await connection.close()
    throw new Error(`No bulk load job found with ID ${jobId}`)
  }

  const job = jobResult[0] as LoadListRow
  const status = mapStateToStatus(job.ll_state, job.ll_error)

  if (status === 'completed' || status === 'failed') {
    await connection.close()
    throw new Error(`Job is already in ${status} state`)
  }

  // Only stop the whole loader when this user's job is actually running;
  // queued jobs can be removed without interrupting other users.
  if (status === 'in-progress') {
    await connection.query('rdf_load_stop()')
  }

  // Delete the job from LOAD_LIST
  await connection.query(`
    DELETE FROM DB.DBA.LOAD_LIST
    WHERE ll_file LIKE '${scopedFilePattern(parsed.userId, parsed.filename)}' AND ll_graph = '${parsed.graphIri}'
  `)

  await connection.close()

  logger.info('Bulk load job cancelled', { jobId })
}

/**
 * Removes bulk load jobs associated with a filename from LOAD_LIST.
 * @param filename Name of the file
 */
export async function removeBulkLoadJobsForFile(
  session: VirtuosoSession,
  filename: string
): Promise<void> {
  const connection = await getConnection(session)
  await connection.query(`
    DELETE FROM DB.DBA.LOAD_LIST
    WHERE ll_file LIKE '${scopedFilePattern(session.userId, filename)}'
  `)
  await connection.close()
  logger.info('Related bulk load jobs removed', { filename })
}

/**
 * Starts the bulk RDF loading process using Virtuoso's parallel loader.
 * Determines optimal thread count based on CPU cores and initiates loader workers.
 * Runs checkpoint after loading to commit data.
 */
export async function startBulkLoad(session: VirtuosoSession): Promise<void> {
  logger.info('Starting bulk load process')
  try {
    const connection = await getConnection(session)

    // Get the number of CPU cores
    logger.info('Getting CPU count for bulk load')
    const cpuCountResult = (await connection.query(
      "SELECT sys_stat('st_cpu_count') AS st_cpu_count"
    )) as CpuCountResult[]
    const cpuCount = cpuCountResult[0].st_cpu_count
    logger.info('CPU count for bulk load', { cpuCount })

    // Virtuoso's loader benefits from leaving headroom; use ~40% of cores to balance throughput and keep the DB responsive.
    const loaderThreads = Math.max(1, Math.floor(cpuCount / 2.5))

    // Start multiple loader threads
    logger.info('Starting bulk loader threads', { threads: loaderThreads })
    const loaderPromises = []
    for (let i = 0; i < loaderThreads; i++) {
      // rdf_loader_run() spins up a loader worker per Virtuoso docs: https://docs.openlinksw.com/virtuoso/fn_rdf_loader_run/
      loaderPromises.push(connection.query('rdf_loader_run()'))
    }

    // Wait for all loader threads to complete
    await Promise.all(loaderPromises)

    // Run checkpoint to commit the loaded data
    await connection.query('checkpoint')

    await connection.close()

    logger.info('Bulk load process completed')
  } catch (error) {
    const err = error as Error
    logger.error('Error during bulk load process', { error: err.message })
    throw err
  }
}
