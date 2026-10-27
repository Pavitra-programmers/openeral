use std::env;
use std::process::{exit, Command};

fn main() {
    let package_spec = env::var("OPENRIND_DESKTOP_CHROME_DEVTOOLS_MCP_SPEC")
        .or_else(|_| env::var("CHROME_DEVTOOLS_MCP_SPEC"))
        .unwrap_or_else(|_| "chrome-devtools-mcp@0.17.0".to_string());

    let is_win = cfg!(windows);
    let program = if is_win { "npm.cmd" } else { "npm" };
    let mut initial_args = vec![
        "exec".to_string(),
        "--yes".to_string(),
        package_spec,
        "--".to_string(),
    ];

    let user_args: Vec<String> = env::args().skip(1).collect();
    initial_args.extend(user_args);

    let mut cmd = Command::new(program);
    cmd.args(&initial_args);
    cmd.env("npm_config_yes", "true");

    let status = match cmd.status() {
        Ok(s) => s,
        Err(e) => {
            if is_win {
                let mut cmd_args = vec!["/c".to_string(), "npm".to_string()];
                cmd_args.extend(initial_args);
                match Command::new("cmd")
                    .args(&cmd_args)
                    .env("npm_config_yes", "true")
                    .status()
                {
                    Ok(s) => s,
                    Err(e2) => {
                        eprintln!("Control Chrome requires npm (Node.js): {} ({})", e, e2);
                        exit(1);
                    }
                }
            } else {
                eprintln!("Control Chrome requires npm (Node.js): {}", e);
                exit(1);
            }
        }
    };

    exit(status.code().unwrap_or(1));
}
