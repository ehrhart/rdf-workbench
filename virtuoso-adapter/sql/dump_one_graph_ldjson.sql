CREATE PROCEDURE dump_one_graph_ldjson
  ( IN  srcgraph           VARCHAR
  , IN  out_file           VARCHAR
  , IN  file_length_limit  INTEGER  := 1000000000
  )
  {
    DECLARE  file_name     VARCHAR;
    DECLARE  env, ses             ANY;
    DECLARE  ses_len
          ,  max_ses_len
          ,  file_len
          ,  file_idx      INTEGER;
    DECLARE  extension     VARCHAR;
    DECLARE  last_status
      ,  wrote_any
      ,  array_open
      ,  total_triples INTEGER;
   SET ISOLATION = 'uncommitted';
   max_ses_len  := 10000000;
   file_len     := 0;
   file_idx     := 1;
   extension := '.jsonld';
   file_name    := sprintf ('%s%06d%s', out_file, file_idx, extension);
   string_to_file ( file_name, '', -2 );
   env := vector (NULL, NULL, NULL, NULL);
   ses := string_output ();
   last_status := 0;
   wrote_any := 0;
  array_open := 0;
  total_triples := 0;
   FOR (SELECT * FROM ( SPARQL DEFINE input:storage ""
                         SELECT ?s ?p ?o { GRAPH `iri(?:srcgraph)` { ?s ?p ?o } }
                       ) AS sub OPTION (LOOP)) DO
      {
        IF (array_open = 0)
          {
            http ('[\n', ses);
            array_open := 1;
          }
    last_status := http_ld_json_triple (env, "s", "p", "o", ses);
    wrote_any := 1;
    total_triples := total_triples + 1;
        ses_len := length (ses);
        IF (ses_len > max_ses_len)
          {
            file_len := file_len + ses_len;
            IF (file_len > file_length_limit)
              {
                IF (wrote_any)
                  {
                    IF (last_status = 2)
                      http (' ]', ses);
                    http (' }\n', ses);
                  }
                http (']\n', ses);
                string_to_file (file_name, ses, -1);
                gz_compress_file (file_name, file_name||'.gz');
                file_delete (file_name);
                file_len := 0;
                file_idx := file_idx + 1;
                file_name := sprintf ('%s%06d%s', out_file, file_idx, extension);
                string_to_file ( file_name, '', -2 );
                env := VECTOR (NULL, NULL, NULL, NULL);
                ses := string_output ();
                last_status := 0;
                wrote_any := 0;
                array_open := 0;
              }
            ELSE
              {
                string_to_file (file_name, ses, -1);
                ses := string_output ();
              }
          }
      }
    IF (array_open)
      {
        IF (wrote_any)
          {
            IF (last_status = 2)
              http (' ]', ses);
            http (' }\n', ses);
          }
        http (']\n', ses);
        string_to_file (file_name, ses, -1);
        gz_compress_file (file_name, file_name||'.gz');
        file_delete (file_name);
      }
    ELSE
      {
        IF (total_triples = 0)
          {
            ses := string_output ();
            http ('[]\n', ses);
            string_to_file (file_name, ses, -1);
            gz_compress_file (file_name, file_name||'.gz');
          }
        file_delete (file_name);
      }
  }
