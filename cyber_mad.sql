-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: localhost:8889
-- Generation Time: Oct 27, 2025 at 04:51 PM
-- Server version: 5.7.44
-- PHP Version: 8.3.14

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `cyber_mad`
--
CREATE DATABASE IF NOT EXISTS `cyber_mad` DEFAULT CHARACTER SET utf8 COLLATE utf8_general_ci;
USE `cyber_mad`;

-- --------------------------------------------------------

--
-- Table structure for table `courses`
--

CREATE TABLE `courses` (
  `id` int(5) NOT NULL,
  `title` varchar(100) NOT NULL DEFAULT '',
  `description` varchar(250) NOT NULL,
  `units` int(1) NOT NULL,
  `start_date` int(9) NOT NULL,
  `end_date` int(9) NOT NULL,
  `meeting_days` varchar(15) NOT NULL DEFAULT '',
  `meeting_time_start` int(4) NOT NULL,
  `meeting_time_end` int(4) NOT NULL,
  `last_day_to_add` int(9) NOT NULL,
  `last_day_to_drop` int(9) NOT NULL,
  `instructor_id` int(8) NOT NULL,
  `prereq_coreq` varchar(17) NOT NULL DEFAULT '',
  `textbooks_required` varchar(17) NOT NULL DEFAULT '',
  `add_code` int(4) NOT NULL,
  `published` tinyint(1) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `courses_enrolled`
--

CREATE TABLE `courses_enrolled` (
  `course_id` int(5) NOT NULL,
  `student_id` int(8) NOT NULL,
  `status` int(1) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `final_grades`
--

CREATE TABLE `final_grades` (
  `course_id` int(5) NOT NULL,
  `student_id` int(8) NOT NULL,
  `term` int(6) NOT NULL,
  `grade` char(1) NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `textbooks`
--

CREATE TABLE `textbooks` (
  `id` int(5) NOT NULL,
  `title` varchar(100) NOT NULL DEFAULT '',
  `description` varchar(250) NOT NULL DEFAULT '',
  `price` float NOT NULL,
  `quantity` int(4) NOT NULL,
  `course_id` int(5) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `user_profiles`
--

CREATE TABLE `user_profiles` (
  `id` int(8) NOT NULL,
  `first_name` varchar(100) NOT NULL DEFAULT '',
  `last_name` varchar(100) NOT NULL DEFAULT '',
  `email` varchar(100) NOT NULL DEFAULT '',
  `phone` int(9) NOT NULL,
  `street_addr` varchar(100) NOT NULL DEFAULT '',
  `city` varchar(100) NOT NULL DEFAULT '',
  `state` varchar(100) NOT NULL DEFAULT '',
  `country` varchar(100) NOT NULL DEFAULT '',
  `acct_type` tinyint(1) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `courses`
--
ALTER TABLE `courses`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `courses_enrolled`
--
ALTER TABLE `courses_enrolled`
  ADD PRIMARY KEY (`course_id`);

--
-- Indexes for table `final_grades`
--
ALTER TABLE `final_grades`
  ADD PRIMARY KEY (`course_id`);

--
-- Indexes for table `textbooks`
--
ALTER TABLE `textbooks`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `user_profiles`
--
ALTER TABLE `user_profiles`
  ADD PRIMARY KEY (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
