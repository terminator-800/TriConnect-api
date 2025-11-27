// Users Schema
export async function createUsersTable() {
  `
    CREATE TABLE IF NOT EXISTS users (
      user_id INT AUTO_INCREMENT PRIMARY KEY,
      role ENUM('jobseeker', 'business-employer', 'individual-employer', 'manpower-provider', 'administrator') NOT NULL,
      is_registered BOOLEAN DEFAULT FALSE,
      is_verified BOOLEAN DEFAULT FALSE,
      is_submitted BOOLEAN DEFAULT FALSE,
      is_rejected BOOLEAN DEFAULT FALSE,
      verified_at DATETIME NULL DEFAULT NULL,
      is_subscribed BOOLEAN DEFAULT FALSE,
      subscription_start DATE DEFAULT NULL, 
      subscription_end DATE DEFAULT NULL,  
      email VARCHAR(100) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      profile VARCHAR(255), 

      -- Token to manage single active session
      current_token VARCHAR(255) DEFAULT NULL,

      -- Account status fields
      account_status ENUM('active', 'restricted', 'blocked', 'suspended', 'banned') DEFAULT 'active',
      status_reason TEXT,
      status_updated_at DATETIME DEFAULT NULL,

      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
}

// Business Employer Schema
export async function createBusinessEmployerTable() {
  `
    CREATE TABLE IF NOT EXISTS business_employer (
      business_employer_id INT PRIMARY KEY,
      business_name VARCHAR(100),
      business_address VARCHAR(255),
      industry VARCHAR(100),
      business_size VARCHAR(50),
      authorized_person VARCHAR(100),
      authorized_person_id VARCHAR(255),
      business_permit_BIR VARCHAR(255),
      DTI VARCHAR(255),
      business_establishment VARCHAR(255),
      profile VARCHAR(255), 
      FOREIGN KEY (business_employer_id) REFERENCES users(user_id) ON DELETE CASCADE
    );
  `;
}

// Individual Employer Schema
export async function createIndividualEmployerTable() {
  `
    CREATE TABLE IF NOT EXISTS individual_employer (
      individual_employer_id INT PRIMARY KEY,
      full_name VARCHAR(100),
      date_of_birth DATE,
      phone VARCHAR(20),
      gender ENUM('Male', 'Female', 'Other'),
      present_address VARCHAR(255),
      permanent_address VARCHAR(255),
      government_id VARCHAR(255),
      selfie_with_id VARCHAR(255),
      nbi_barangay_clearance VARCHAR(255),
      profile VARCHAR(255), 
      FOREIGN KEY (individual_employer_id) REFERENCES users(user_id) ON DELETE CASCADE
    );
  `;
}

// Jobseeker Schema
export async function createJobseekerTable() {
  `
    CREATE TABLE IF NOT EXISTS jobseeker (
      jobseeker_id INT PRIMARY KEY,
      full_name VARCHAR(100),
      date_of_birth DATE,
      phone VARCHAR(20),
      gender ENUM('Male', 'Female', 'Other'),
      present_address VARCHAR(255),
      permanent_address VARCHAR(255),
      education TEXT,
      skills TEXT,
      government_id VARCHAR(255),
      selfie_with_id VARCHAR(255),
      nbi_barangay_clearance VARCHAR(255),
      profile VARCHAR(255), 
      FOREIGN KEY (jobseeker_id) REFERENCES users(user_id) ON DELETE CASCADE
    );
`;
}

// Manpower Provider Schema
export async function createManpowerProviderTable() {
  `
    CREATE TABLE IF NOT EXISTS manpower_provider (
      manpower_provider_id INT PRIMARY KEY,
      agency_name VARCHAR(100),
      agency_address VARCHAR(255),
      agency_services TEXT,
      agency_authorized_person VARCHAR(100),
      dole_registration_number VARCHAR(255),
      mayors_permit VARCHAR(255),
      agency_certificate VARCHAR(255),
      authorized_person_id VARCHAR(255),
      profile VARCHAR(255), 
      FOREIGN KEY (manpower_provider_id) REFERENCES users(user_id) ON DELETE CASCADE
    );
  `;
}

// Conversations Schema
export async function createConversationsTable() {
  `
    CREATE TABLE IF NOT EXISTS conversations (
      conversation_id INT AUTO_INCREMENT PRIMARY KEY,
      user1_id INT NOT NULL,
      user2_id INT NOT NULL,
      user_small_id INT NOT NULL,
      user_large_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_pair (user_small_id, user_large_id)
    );
  `;
}

// Feedback Schema
export async function createFeedbackTable() {
  `
    CREATE TABLE IF NOT EXISTS feedback (
      feedback_id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL UNIQUE,
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    );
  `;
}

// Job Applications Schema
export async function createJobApplicationsTable() {
  `
    CREATE TABLE IF NOT EXISTS job_applications (
      application_id INT AUTO_INCREMENT PRIMARY KEY,
      job_post_id INT NOT NULL, -- Foreign key to the job post
      applicant_id INT NOT NULL, -- Foreign key to the user applying
      application_status ENUM('pending', 'reviewed', 'accepted', 'rejected') DEFAULT 'pending',
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (job_post_id) REFERENCES job_post(job_post_id) ON DELETE CASCADE,
      FOREIGN KEY (applicant_id) REFERENCES users(user_id) ON DELETE CASCADE
    );
`;
}

// Job Post Schema
export async function createJobPostTable() {
  `
    CREATE TABLE IF NOT EXISTS job_post (
       job_post_id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL, -- Foreign key to reference the user
      status ENUM('pending', 'approved', 'rejected', 'draft') DEFAULT NULL,
      jobpost_status ENUM('pending', 'active', 'paused', 'completed', 'archive', 'deleted') DEFAULT NULL,
      submitted_at DATETIME DEFAULT NULL,
      approved_at DATETIME DEFAULT NULL,
      expires_at DATETIME DEFAULT NULL,
      rejection_reason TEXT DEFAULT NULL,
      is_verified_jobpost BOOLEAN DEFAULT FALSE,
      job_title VARCHAR(255) NOT NULL,
      job_type ENUM('Full-time', 'Part-time', 'Contract') NOT NULL,
      salary_range INT,
      location VARCHAR(255),
      required_skill TEXT,
      job_description TEXT,
      applicant_count INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE 
    );
  `;
}

export async function createIndividualJobPostTable() {
  const query = `
    CREATE TABLE IF NOT EXISTS individual_job_post (
      individual_job_post_id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL, -- Foreign key to reference the user
      status ENUM('pending', 'approved', 'rejected', 'draft') DEFAULT NULL,
      jobpost_status ENUM('pending', 'active', 'paused', 'completed', 'archive', 'deleted') DEFAULT NULL,
      submitted_at DATETIME DEFAULT NULL,
      approved_at DATETIME DEFAULT NULL,
      expires_at DATETIME DEFAULT NULL,
      rejection_reason TEXT DEFAULT NULL,
      is_verified_jobpost BOOLEAN DEFAULT FALSE,
      worker_name VARCHAR(255) DEFAULT NULL,
      worker_category VARCHAR(255) DEFAULT NULL,
      years_of_experience INT DEFAULT NULL,
      location VARCHAR(255) DEFAULT NULL,
      qualifications TEXT DEFAULT NULL,
      skill VARCHAR(255) DEFAULT NULL,
      applicant_count INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE 
    );
  `;
  try {
    await connection.execute(query);
  } catch (error) {
    throw error;
  }
}

export async function createTeamJobPostTable() {
  const query = `
    CREATE TABLE IF NOT EXISTS team_job_post (
      team_job_post_id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL, -- Foreign key to reference the user
      status ENUM('pending', 'approved', 'rejected', 'draft') DEFAULT NULL,
      jobpost_status ENUM('pending', 'active', 'paused', 'completed', 'archive', 'deleted') DEFAULT NULL,
      submitted_at DATETIME DEFAULT NULL,
      approved_at DATETIME DEFAULT NULL,
      expires_at DATETIME DEFAULT NULL,
      rejection_reason TEXT DEFAULT NULL,
      is_verified_jobpost BOOLEAN DEFAULT FALSE,
      worker_category VARCHAR(255) DEFAULT NULL,
      number_of_workers INT DEFAULT NULL,
      location VARCHAR(255) DEFAULT NULL,
      senior_workers INT DEFAULT NULL,
      mid_level_workers INT DEFAULT NULL,
      junior_workers INT DEFAULT NULL,
      entry_level_workers INT DEFAULT NULL,
      team_skills TEXT DEFAULT NULL,
      applicant_count INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE 
    );
  `;
  try {
    await connection.execute(query);
  } catch (error) {
    throw error;
  }
}

// Messages Schema
export async function createMessagesTable() {
  `
    CREATE TABLE IF NOT EXISTS messages (
      message_id INT AUTO_INCREMENT PRIMARY KEY,
      conversation_id INT NOT NULL,
      sender_id INT NOT NULL,
      receiver_id INT NOT NULL,
      read_at DATETIME NULL,
      is_read BOOLEAN DEFAULT FALSE,
      full_name VARCHAR(255) NULL,
      phone_number VARCHAR(50) NULL,
      email_address VARCHAR(255) NULL,
      current_address VARCHAR(255) NULL,
      cover_letter TEXT NULL,
      message_text TEXT NULL,
      job_title VARCHAR(255) NULL,
      resume VARCHAR(255) NULL,
      message_type ENUM('text', 'image', 'file', 'apply') DEFAULT 'text',
      file_url VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversation_id) REFERENCES conversations(conversation_id) ON DELETE CASCADE,
      INDEX idx_conversation_id (conversation_id),
      INDEX idx_receiver_id (receiver_id)
    );
  `;
}

// Report Proof Schema
export async function createReportProofsTable() {
  `
    CREATE TABLE IF NOT EXISTS report_proofs (
      proof_id INT AUTO_INCREMENT PRIMARY KEY,
      report_id INT NOT NULL,
      file_url VARCHAR(255) NOT NULL,
      file_type ENUM('image', 'file') DEFAULT 'image',
      uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

      -- 🔗 Foreign key linking to the reports table
      FOREIGN KEY (report_id) REFERENCES reports(report_id) ON DELETE CASCADE,

      -- 📦 Index for quick lookup by report
      INDEX idx_report_id (report_id)
    );
  `;
}

// Reports Schema
export async function createReportsTable() {
  `
    CREATE TABLE IF NOT EXISTS reports (
      report_id INT AUTO_INCREMENT PRIMARY KEY,
      reported_by INT NOT NULL,
      reported_user_id INT NOT NULL,
      reason TEXT NOT NULL,
      message TEXT,
      conversation_id INT, -- nullable: if report is about a chat
      job_post_id INT,     -- nullable: if report is about a job post
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      status ENUM('pending', 'reviewed', 'resolved') DEFAULT 'pending',

      -- 🔐 Prevent duplicate reports from the same user
      UNIQUE (reported_by, reported_user_id),

      FOREIGN KEY (reported_by) REFERENCES users(user_id) ON DELETE CASCADE,
      FOREIGN KEY (reported_user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      FOREIGN KEY (conversation_id) REFERENCES conversations(conversation_id) ON DELETE SET NULL,
      FOREIGN KEY (job_post_id) REFERENCES job_post(job_post_id) ON DELETE SET NULL,

      INDEX idx_reported_by (reported_by),
      INDEX idx_reported_user_id (reported_user_id),
      INDEX idx_conversation_id (conversation_id),
      INDEX idx_job_post_id (job_post_id)
    );
  `;
}

export async function createNotificationTable() {
  const query = `
    CREATE TABLE IF NOT EXISTS notifications (
        notification_id INT AUTO_INCREMENT PRIMARY KEY,

        -- Who receives the notification
        user_id INT NOT NULL,

        -- Who triggered the notification
        notifier_id  INT NULL,

        -- Notification category
        type ENUM(
            'message',
            'job_application',
            'job_post_status',
            'account_verification',
            'report',
            'system'
        ) NOT NULL,

        -- Title + content
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,

        -- Optional reference to other tables
        reference_id INT NULL,
        reference_type ENUM(
            'conversation',
            'message',
            'job_post',
            'job_application',
            'report',
            'user'
        ) NULL,

        -- Read status
        is_read BOOLEAN DEFAULT FALSE,

        -- Timestamp
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        -- Foreign key
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        FOREIGN KEY (notifier_id) REFERENCES users(user_id) ON DELETE SET NULL,

        -- Indexes for performance
        INDEX idx_user_id (user_id),
        INDEX idx_reference_id (reference_id)
        );
  `;
}
