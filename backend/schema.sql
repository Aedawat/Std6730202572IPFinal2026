USE `ip_std6730202572`;

CREATE TABLE IF NOT EXISTS `Aedawat_Jumpla` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL,
  `position` VARCHAR(150) NOT NULL,
  `status` ENUM('Active', 'On Leave') NOT NULL DEFAULT 'Active',
  `salary` DECIMAL(12, 2) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

INSERT INTO `Aedawat_Jumpla` (`id`, `name`, `position`, `status`, `salary`)
SELECT seed.`id`, seed.`name`, seed.`position`, seed.`status`, seed.`salary`
FROM (
  SELECT
    '00000000-0000-4000-8000-000000000001' AS `id`,
    'Ava Johnson' AS `name`,
    'HR Manager' AS `position`,
    'Active' AS `status`,
    85000 AS `salary`
  UNION ALL
  SELECT
    '00000000-0000-4000-8000-000000000002',
    'Liam Smith',
    'Software Engineer',
    'Active',
    105000
  UNION ALL
  SELECT
    '00000000-0000-4000-8000-000000000003',
    'Emma Davis',
    'Recruiter',
    'On Leave',
    62000
  UNION ALL
  SELECT
    '00000000-0000-4000-8000-000000000004',
    'Noah Wilson',
    'Product Designer',
    'Active',
    78000
  UNION ALL
  SELECT
    '00000000-0000-4000-8000-000000000005',
    'Olivia Brown',
    'Finance Analyst',
    'Active',
    72000
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM `Aedawat_Jumpla`);
