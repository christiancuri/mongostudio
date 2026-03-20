use crate::error::AppResult;

#[allow(dead_code)]
pub struct SshTunnel {
    local_port: u16,
}

#[allow(dead_code)]
impl SshTunnel {
    pub fn new(
        _ssh_host: &str,
        _ssh_port: u16,
        _ssh_user: &str,
        _remote_host: &str,
        _remote_port: u16,
    ) -> AppResult<Self> {
        // TODO: Implement SSH tunnel via ssh2 crate
        Ok(Self { local_port: 0 })
    }

    pub fn local_port(&self) -> u16 {
        self.local_port
    }
}

impl Drop for SshTunnel {
    fn drop(&mut self) {
        // Close SSH tunnel
    }
}
