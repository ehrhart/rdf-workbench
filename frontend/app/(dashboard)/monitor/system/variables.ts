// System statistics fetchable from the monitor, organized by category.
// Shared by the client render and the sysStat server action, which
// validates requested ids against this list.
export const systemVariables = {
  general: [
    'st_dbms_name',
    'st_dbms_ver',
    'st_build_date',
    'st_build_thread_model',
    'st_build_opsys_id',
    'st_host_name',
    'st_cpu_count',
    'db_ver_string',
    'git_head'
  ],
  database: [
    'st_db_file_size',
    'st_db_pages',
    'st_db_page_size',
    'st_db_free_pages',
    'db_default_columnstore',
    'db_exists',
    'st_lite_mode'
  ],
  memory: [
    'st_db_buffers',
    'st_db_used_buffers',
    'st_db_dirty_buffers',
    'st_db_wired_buffers',
    'st_sys_ram',
    'mp_large_in_use',
    'mp_max_large_in_use',
    'mp_mmap_clocks'
  ],
  performance: [
    'disk_reads',
    'disk_writess',
    'read_cum_time',
    'write_cum_time',
    'st_db_disk_read_avg',
    'st_db_disk_read_pct',
    'st_inx_pages_changed',
    'st_inx_pages_new'
  ],
  locks: ['lock_deadlocks', 'lock_waits', 'lock_enters', 'lock_leaves'],
  processes: [
    'st_proc_served',
    'st_proc_active',
    'st_proc_running',
    'st_proc_queued_req',
    'thr_thread_num_total',
    'thr_thread_num_wait',
    'thr_cli_running',
    'thr_cli_waiting'
  ],
  connections: [
    'st_cli_connects',
    'st_cli_max_connected',
    'st_cli_n_current_connections',
    'st_cli_n_http_threads',
    'tws_connections',
    'tws_requests',
    'tws_max_connects'
  ],
  rdf: [
    'enable_rdf_box_const',
    'rdf_rpid64_mode',
    'disable_rdf_init',
    'enable_rdf_trig'
  ]
}

export const allSystemVariables: string[] = Object.values(
  systemVariables
).flat()
