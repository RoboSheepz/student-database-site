-- Database: `userdb`

CREATE DATABASE IF NOT EXISTS `userdb` DEFAULT CHARACTER SET utf8 COLLATE utf8_general_ci;
USE `userdb`;

-- Table structure for table `users`

CREATE TABLE `users` (
  `id` int(8) NOT NULL,
  `email` varchar(255) NOT NULL DEFAULT '',
  `password` varchar(255) NOT NULL DEFAULT '',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `acct_type` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

ALTER TABLE `users`
  ADD PRIMARY KEY (`id`);
COMMIT;
