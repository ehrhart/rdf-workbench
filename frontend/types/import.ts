export type ImportStatus = 'queued' | 'in-progress' | 'completed' | 'failed'

export interface BulkLoadRequest {
  filename: string
  graphIri: string
}

export interface UploadResponse {
  filename: string
  size: number
  path: string
}

export interface BulkLoadTriggerResponse {
  jobId: string
  status: ImportStatus
  message?: string
}

export interface MutationSuccessResponse {
  success?: boolean
  message?: string
  error?: string
}

export interface BulkLoadJobApiPayload {
  jobId?: string
  filename?: string
  graphIri?: string
  status?: ImportStatus
  state?: number | null
  started?: string | null
  done?: string | null
  workTime?: number | null
  message?: string | null
  error?: string | null
  host?: number | null
  ll_file?: string
  ll_graph?: string
  ll_state?: number | null
  ll_started?: string | null
  ll_done?: string | null
  ll_work_time?: number | null
  ll_error?: string | null
  startTime?: string | null
  endTime?: string | null
}

export interface BulkLoadJob {
  jobId: string
  filename: string
  graphIri: string
  status: ImportStatus
  started: string | null
  done: string | null
  workTime: number | null
  message: string | null
  error: string | null
}

export interface BulkLoadJobsResponse {
  jobs: BulkLoadJobApiPayload[]
}
