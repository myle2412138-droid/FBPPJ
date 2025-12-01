-- Create Database
CREATE DATABASE IF NOT EXISTS fbp_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE fbp_db;

-- Create Table
CREATE TABLE IF NOT EXISTS medical_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_name VARCHAR(255) NOT NULL,
    timestamp VARCHAR(50),
    report_text TEXT,
    tumor_count INT DEFAULT 0,
    patient_status VARCHAR(255),
    video_url VARCHAR(255),
    image_urls TEXT,
    raw_json JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
