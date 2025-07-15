import { db } from "./db.js";

export const createDbSchema = async () => {
  try {
    // Users
    await db.query(`CREATE TABLE IF NOT EXISTS users(
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL DEFAULT '',
            phone VARCHAR(10) NOT NULL, 
            profile_image TEXT NOT NULL DEFAULT '',
            fcm_token TEXT NOT NULL DEFAULT '',
            device_type ENUM('A','I','W') NOT NULL DEFAULT 'W',
            status ENUM('1', '2') NOT NULL DEFAULT '1',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`);

    await db.query(`CREATE TABLE IF NOT EXISTS tokens(
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            token TEXT NOT NULL, 
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);

    await db.query(`CREATE TABLE IF NOT EXISTS otps( 
            id INT AUTO_INCREMENT PRIMARY KEY, 
            otp VARCHAR(10) NOT NULL,
            phone VARCHAR(10) NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);

    await db.query(`CREATE TABLE IF NOT EXISTS gurudwaras(
            id INT AUTO_INCREMENT PRIMARY KEY, 
            name VARCHAR(255) NOT NULL,
            address VARCHAR(255) NOT NULL,
            image_urls JSON NOT NULL,
            latitude DECIMAL(10,8) NOT NULL,
            longitude DECIMAL(11,8) NOT NULL,
            qr_code_url TEXT NOT NULL,
            qr_scan_points INT NOT NULL DEFAULT 10,
            status ENUM('1', '2') NOT NULL DEFAULT '1',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);

    await db.query(`CREATE TABLE IF NOT EXISTS rewards(
            id INT AUTO_INCREMENT PRIMARY KEY,
            gurudwara_id INT NOT NULL, 
            title VARCHAR(255),
            description TEXT,
            points INT NOT NULL,
            image_urls JSON NOT NULL,
            status ENUM('1', '2') NOT NULL DEFAULT '1',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )`);

    await db.query(`CREATE TABLE IF NOT EXISTS quizzes( 
            id INT AUTO_INCREMENT PRIMARY KEY,
            question TEXT NOT NULL,
            option_1 TEXT NOT NULL,
            option_2 TEXT NOT NULL,
            option_3 TEXT NOT NULL,
            option_4 TEXT NOT NULL,
            correct_option INT NOT NULL,
            points INT NOT NULL,
            status ENUM('1', '2') NOT NULL DEFAULT '1',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            update_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )`);

    await db.query(`CREATE TABLE IF NOT EXISTS quiz_submissions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            quiz_id INT NOT NULL,
            selected_option INT NOT NULL,
            is_correct BOOLEAN NOT NULL,
            points_earned INT NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (quiz_id) REFERENCES quizzes(id),
            UNIQUE KEY unique_user_quiz (user_id, quiz_id)
        )`);
    await db.query(`CREATE TABLE IF NOT EXISTS favourite_gurudwaras(
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL, 
            gurudwara_id INT NOT NULL,
            status ENUM('1', '2') NOT NULL DEFAULT '1',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);

    await db.query(`CREATE TABLE IF NOT EXISTS privacy_policy(
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            description TEXT NOT NULL,
            status ENUM('1', '2') NOT NULL DEFAULT '1',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
         )`);

    await db.query(`CREATE TABLE IF NOT EXISTS terms_conditions(
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            description TEXT NOT NULL,
            status ENUM('1', '2') NOT NULL DEFAULT '1',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

    await db.query(`CREATE TABLE IF NOT EXISTS rewards_redeemed( 
            id INT AUTO_INCREMENT PRIMARY KEY, 
            user_id INT NOT NULL, 
            reward_id INT NOT NULL, 
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);

    await db.query(`CREATE TABLE IF NOT EXISTS points_earned(
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            reward_type ENUM('quiz','qr_scanned'),
            quiz_id INT NULL,
            gurudwara_id INT NULL,
            points INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

    await db.query(
      `CREATE TABLE IF NOT EXISTS term_conditions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          description TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`
    );

    await db.query(`CREATE TABLE IF NOT EXISTS privacy_policy (
          id INT AUTO_INCREMENT PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          description TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`);

    await db.query(`CREATE TABLE IF NOT EXISTS attendance_logs(
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          gurudwara_id INT NOT NULL,
          visit_date DATE NOT NULL,
          visit_time TIME NOT NULL,
          points_awarded INT DEFAULT 0,
          is_first_visit_today BOOLEAN DEFAULT true,
          latitude DECIMAL(10,8) NOT NULL,
          longitude DECIMAL(11,8) NOT NULL,
          -- device_info JSON,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

    await db.query(`CREATE TABLE IF NOT EXISTS admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('super_admin', 'local_admin') NOT NULL DEFAULT 'local_admin',
    gurudwara_id INT NULL,
    status ENUM('1', '2') NOT NULL DEFAULT '1',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);`);

    console.log("All tables created succesfully");
  } catch (err) {
    console.log("Error in creating the schema", err.message);
  }
};
