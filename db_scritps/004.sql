CREATE TABLE public.message_files
(
    id integer NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 START 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 ),
    "fileName" character varying(255) COLLATE pg_catalog."default",
    "originalFileName" character varying COLLATE pg_catalog."default",
    type character varying COLLATE pg_catalog."default",
    message_id integer,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT message_files_id PRIMARY KEY (id),
    CONSTRAINT message_files_fk FOREIGN KEY (message_id)
        REFERENCES public.messages (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE public.message_files
    OWNER to postgres;

CREATE INDEX fki_message_files_fk
    ON public.message_files USING btree
    (message_id)
    TABLESPACE pg_default;