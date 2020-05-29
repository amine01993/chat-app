ALTER TABLE public.users DROP COLUMN "chatPicture";

ALTER TABLE public.users
    RENAME "profilePicture" TO picture;