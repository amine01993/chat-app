
ALTER TABLE public.channel_user
    ADD COLUMN joined_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;