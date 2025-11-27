export const SELECT_ADMIN_BY_EMAIL = `
    SELECT * FROM users 
    WHERE email = ? 
    AND role = 'administrator'
`;

export const INSERT_ADMIN = `
    INSERT INTO users (
        email, 
        password, 
        role, 
        is_registered,
        is_verified,
        is_submitted,
        verified_at
    ) VALUES (?, ?, 'administrator', ?, ?, ?, NOW())
`;