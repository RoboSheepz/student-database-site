-- Create database (if not exists)
CREATE DATABASE IF NOT EXISTS `userdb` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `userdb`;

-- Drop table if exists (only for fresh setup - remove this line if you have real data!)
-- DROP TABLE IF EXISTS `users`;

-- Updated users table with permanent invite_code
CREATE TABLE `users` (
  `id` INT(8) UNSIGNED NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(255) NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `acct_type` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '0 = student, 1 = admin',
  `invite_code` VARCHAR(20) DEFAULT NULL COMMENT 'Permanent invite code (only for admins)',
  `used_invite_code` VARCHAR(20) DEFAULT NULL COMMENT 'Which code was used to create this account (for tracking)',
  
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_email` (`email`),
  UNIQUE KEY `unique_invite_code` (`invite_code`),
  KEY `idx_acct_type` (`acct_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Optional: Automatically generate a permanent invite code when a new admin is created
DELIMITER $$
CREATE TRIGGER `generate_admin_invite_code` BEFORE INSERT ON `users`
FOR EACH ROW
BEGIN
  IF NEW.acct_type = 1 AND (NEW.invite_code IS NULL OR NEW.invite_code = '') THEN
    SET NEW.invite_code = CONCAT(
      'ADM',
      LPAD(NEW.id, 6, '0'),
      SUBSTR(MD5(RAND()), 1, 6)
    );
  END IF;
END$$
DELIMITER ;

-- Example: Create your first admin (run this once)
INSERT INTO `users` (email, password, acct_type) VALUES 
('admin@example.com', '$2b$12$your_hashed_password_here', 1);

-- If you already have admins, run this to give them permanent codes:
UPDATE `users` 
SET invite_code = CONCAT('ADM', LPAD(id, 6, '0'), SUBSTR(MD5(RAND()), 1, 6))
WHERE acct_type = 1 
  AND (invite_code IS NULL OR invite_code = '');

-- Make sure all current admins have unique codes
-- (Run this if you get duplicate errors)
UPDATE `users` AS u1
JOIN (
  SELECT id, CONCAT('ADM', LPAD(id, 6, '0'), SUBSTR(MD5(CONCAT(id, NOW())), 1, 6)) AS newcode
  FROM `users` 
  WHERE acct_type = 1 AND invite_code IS NULL
) AS u2 ON u1.id = u2.id
SET u1.invite_code = u2.newcode;
