CREATE PROCEDURE dump_one_graph_rdfxml
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
      ,  header_written
      ,  total_triples INTEGER;
   SET ISOLATION = 'uncommitted';
   max_ses_len  := 10000000;
   file_len     := 0;
   file_idx     := 1;
   extension := '.rdf';
   file_name    := sprintf ('%s%06d%s', out_file, file_idx, extension);
  string_to_file ( file_name, '', -2 );
  env := vector (dict_new (), NULL, NULL, NULL, NULL, 0, 0, 0, NULL, NULL);
  ses := string_output ();
  last_status := 0;
  wrote_any := 0;
  header_written := 0;
  total_triples := 0;
   FOR (SELECT * FROM ( SPARQL DEFINE input:storage ""
                         SELECT ?s ?p ?o { GRAPH `iri(?:srcgraph)` { ?s ?p ?o } }
                       ) AS sub OPTION (LOOP)) DO
      {
        IF (header_written = 0)
          {
            http ('<?xml version="1.0" encoding="UTF-8"?>\n', ses);
            http ('<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">', ses);
            header_written := 1;
          }
  last_status := http_rdfxml_triple (env, "s", "p", "o", ses);
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
                    /* Finish current RDF/XML document before rotating files */
                    IF (env[2] IS NOT NULL)
                      {
                        http ('\n  </rdf:Description>', ses);
                        env[2] := NULL;
                      }
                    http ('\n</rdf:RDF>\n', ses);
                  }
                string_to_file (file_name, ses, -1);
                gz_compress_file (file_name, file_name||'.gz');
                file_delete (file_name);
                file_len := 0;
                file_idx := file_idx + 1;
                file_name := sprintf ('%s%06d%s', out_file, file_idx, extension);
                string_to_file ( file_name, '', -2 );
                env := vector (dict_new (), NULL, NULL, NULL, NULL, 0, 0, 0, NULL, NULL);
                ses := string_output ();
                last_status := 0;
                wrote_any := 0;
                header_written := 0;
              }
            ELSE
              {
                string_to_file (file_name, ses, -1);
                ses := string_output ();
              }
          }
      }
    IF (wrote_any)
      {
        IF (header_written = 0)
          {
            http ('<?xml version="1.0" encoding="UTF-8"?>\n', ses);
            http ('<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">', ses);
            header_written := 1;
          }
        /* Close any open rdf:Description and the root element */
        IF (env[2] IS NOT NULL)
          {
            http ('\n  </rdf:Description>', ses);
            env[2] := NULL;
          }
        http ('\n</rdf:RDF>\n', ses);
        string_to_file (file_name, ses, -1);
        gz_compress_file (file_name, file_name||'.gz');
        file_delete (file_name);
      }
    ELSE
      {
        IF (total_triples = 0)
          {
            ses := string_output ();
            http ('<?xml version="1.0" encoding="UTF-8"?>\n', ses);
            http ('<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"/>\n', ses);
            string_to_file (file_name, ses, -1);
            gz_compress_file (file_name, file_name||'.gz');
          }
        file_delete (file_name);
      }
  }
