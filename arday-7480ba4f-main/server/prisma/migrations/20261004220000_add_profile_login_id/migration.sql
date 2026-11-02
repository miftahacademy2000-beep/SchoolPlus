ALTER TABLE `profiles`
  ADD COLUMN `login_id` VARCHAR(50) NULL,
  ADD UNIQUE INDEX `profiles_login_id_key` (`login_id`);

ALTER TABLE `archived_users`
  MODIFY COLUMN `full_name` VARCHAR(31) NOT NULL,
  MODIFY COLUMN `email` VARCHAR(38) NULL,
  MODIFY COLUMN `phone` VARCHAR(26) NULL;
