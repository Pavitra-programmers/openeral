#include <errno.h>
#include <signal.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>

static const char PYTHON_BIN[] = "/opt/openrind-openhands/bin/python3.12";
static const char OPENHANDS_ENTRYPOINT[] = "/opt/openrind-openhands/openhands-agent.py";
static volatile sig_atomic_t child_pid = -1;

static void forward_signal(int signal_number) {
    int saved_errno = errno;
    pid_t pid = (pid_t)child_pid;

    if (pid > 0) {
        (void)kill(pid, signal_number);
    }
    errno = saved_errno;
}

static int install_handler(int signal_number, void (*handler)(int)) {
    struct sigaction action = {0};

    action.sa_handler = handler;
    if (sigemptyset(&action.sa_mask) == -1) {
        return -1;
    }
    return sigaction(signal_number, &action, NULL);
}

static int configure_forwarding_handlers(void) {
    if (install_handler(SIGINT, forward_signal) == -1 ||
        install_handler(SIGTERM, forward_signal) == -1 ||
        install_handler(SIGHUP, forward_signal) == -1) {
        return -1;
    }
    return 0;
}

static int restore_default_handlers(void) {
    if (install_handler(SIGINT, SIG_DFL) == -1 ||
        install_handler(SIGTERM, SIG_DFL) == -1 ||
        install_handler(SIGHUP, SIG_DFL) == -1) {
        return -1;
    }
    return 0;
}

int main(int argc, char **argv) {
    sigset_t forwarded_signals;
    sigset_t original_mask;
    char *openhands_argv[6] = {
        (char *)PYTHON_BIN,
        (char *)"-I",
        (char *)OPENHANDS_ENTRYPOINT,
        NULL,
        NULL,
    };
    pid_t pid;
    int status;

    if (argc != 2 || (strcmp(argv[1], "cli") != 0 && strcmp(argv[1], "script") != 0)) {
        fprintf(stderr, "openrind-openhands-agent: expected cli or script mode\n");
        return 2;
    }
    openhands_argv[3] = argv[1];

    if (unsetenv("PYTHONPATH") == -1 || unsetenv("PYTHONHOME") == -1) {
        perror("openrind-openhands-agent: sanitize Python environment");
        return 1;
    }

    if (sigemptyset(&forwarded_signals) == -1 ||
        sigaddset(&forwarded_signals, SIGINT) == -1 ||
        sigaddset(&forwarded_signals, SIGTERM) == -1 ||
        sigaddset(&forwarded_signals, SIGHUP) == -1 ||
        sigprocmask(SIG_BLOCK, &forwarded_signals, &original_mask) == -1) {
        perror("openrind-openhands-agent: block signals");
        return 1;
    }

    if (configure_forwarding_handlers() == -1) {
        perror("openrind-openhands-agent: install signal handlers");
        return 1;
    }

    pid = fork();
    if (pid == -1) {
        perror("openrind-openhands-agent: fork");
        
        return 1;
    }

    if (pid == 0) {
        if (restore_default_handlers() == -1 ||
            sigprocmask(SIG_SETMASK, &original_mask, NULL) == -1) {
            perror("openrind-openhands-agent: restore child signals");
            _exit(126);
        }
        execv(PYTHON_BIN, openhands_argv);
        int exec_errno = errno;
        perror("openrind-openhands-agent: exec /opt/openrind-openhands/bin/python3.12");
        _exit(exec_errno == ENOENT ? 127 : 126);
    }

    child_pid = pid;
    
    if (sigprocmask(SIG_SETMASK, &original_mask, NULL) == -1) {
        perror("openrind-openhands-agent: restore parent signals");
        (void)kill(pid, SIGTERM);
        return 1;
    }

    while (waitpid(pid, &status, 0) == -1) {
        if (errno != EINTR) {
            perror("openrind-openhands-agent: waitpid");
            return 1;
        }
    }
    child_pid = -1;

    if (WIFEXITED(status)) {
        return WEXITSTATUS(status);
    }
    if (WIFSIGNALED(status)) {
        return 128 + WTERMSIG(status);
    }
    return 1;
}
