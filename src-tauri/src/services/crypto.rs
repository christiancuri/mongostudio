use crate::error::AppResult;

#[allow(dead_code)]
pub fn encrypt_password(password: &str) -> AppResult<String> {
    // TODO: Implement AES-GCM encryption
    Ok(password.to_string())
}

#[allow(dead_code)]
pub fn decrypt_password(encrypted: &str) -> AppResult<String> {
    // TODO: Implement AES-GCM decryption
    Ok(encrypted.to_string())
}
