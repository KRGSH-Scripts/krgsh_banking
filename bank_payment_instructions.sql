-- Optional manual migration (table is also created by server bootstrap in server/main.lua)
CREATE TABLE IF NOT EXISTS `bank_payment_instructions` (
  `id` varchar(64) NOT NULL,
  `kind` varchar(32) NOT NULL,
  `debtor_account_id` varchar(64) NOT NULL,
  `creditor_target` varchar(64) NOT NULL,
  `amount` int(11) NOT NULL DEFAULT 0,
  `interval_seconds` int(11) NOT NULL DEFAULT 0,
  `next_run_at` bigint NOT NULL,
  `status` varchar(32) NOT NULL,
  `metadata` longtext NOT NULL,
  `created_at` bigint NOT NULL,
  `updated_at` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_pi_next_run` (`next_run_at`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
