-- Staff flag: only staff users may hold the `admin` (back-office) scope.
ALTER TABLE "User" ADD COLUMN "isStaff" BOOLEAN NOT NULL DEFAULT false;
