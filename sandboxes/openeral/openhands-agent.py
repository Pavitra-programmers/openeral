"""Fixed, image-owned entrypoint for OpenHands CLI and headless task files.

Executed with isolated Python by the native launcher. No upstream secret or
trace identity is persisted in the workspace or OpenHands settings.
"""
import os
from pathlib import Path
import re
import sys

WORKSPACE = Path('/sandbox/work')
BASE_URL = os.environ.get('HALOOP_GATEWAY_URL', 'http://136.112.93.84:8787')
CONTEXT_RE = re.compile(r'v1\.[0-9a-f]{32}\.[1-9][0-9]{9,15}\.[1-9][0-9]{9,15}\.[0-9a-f]{64}')


def task_file(value):
    path = (WORKSPACE / value).resolve(strict=True)
    if not path.is_relative_to(WORKSPACE) or not path.is_file():
        raise ValueError('Choose a task file inside /sandbox/work.')
    if path.stat().st_size > 64 * 1024:
        raise ValueError('Task files must be at most 64 KiB.')
    if not path.read_text(encoding='utf-8').strip():
        raise ValueError('Task file is empty.')
    return str(path)


def install_session_transport(context):
    # The pinned OpenHands SDK uses HTTPX for both streaming and ordinary
    # provider calls. Add the per-process assertion only at the fixed edge;
    # never put it in agent_settings.json or forward it to another origin.
    import httpx
    send = httpx.Client.send
    async_send = httpx.AsyncClient.send

    def scoped(request):
        request.headers.pop('x-openrind-haloop-session', None)
        url = request.url
        if (url.scheme == 'http' and url.host in ('136.112.93.84', 'host.openshell.internal')
                and url.port == 8787 and url.path in ('/v1/messages', '/v1/messages/count_tokens', '/v1/chat/completions', '/chat/completions')):
            request.headers['x-openrind-haloop-session'] = context
            return True
        return False

    def send_scoped(client, request, *args, **kwargs):
        if scoped(request):
            kwargs['follow_redirects'] = False
        return send(client, request, *args, **kwargs)

    async def async_send_scoped(client, request, *args, **kwargs):
        if scoped(request):
            kwargs['follow_redirects'] = False
        return await async_send(client, request, *args, **kwargs)

    httpx.Client.send = send_scoped
    httpx.AsyncClient.send = async_send_scoped


def main():
    context = os.environ.get('OPENRIND_HALOOP_SESSION_CONTEXT', '')
    if not CONTEXT_RE.fullmatch(context):
        raise ValueError('A signed Desktop Haloop conversation context is required.')
    mode = sys.argv[1] if len(sys.argv) == 2 else ''
    if mode not in ('cli', 'script'):
        raise ValueError('Expected cli or script mode.')
    # Preserve OpenShell's revisioned credential placeholder: its proxy resolves
    # it to the scoped Haloop token only for this authorized native launcher.
    credential = os.environ.get('ANTHROPIC_API_KEY', '')
    if not credential.startswith('openshell:resolve:env:'):
        raise ValueError('The OpenShell Haloop provider credential is missing. Reconnect from Desktop.')
    os.chdir(WORKSPACE)
    os.environ.update({
        'HOME': '/sandbox/openhands-home',
        'LLM_MODEL': 'anthropic/claude-sonnet-4-5-20250929',
        'LLM_BASE_URL': BASE_URL,
        'LLM_API_KEY': credential,
        'ANTHROPIC_BASE_URL': BASE_URL,
        'DO_NOT_TRACK': '1',
    })
    # No nested Docker/cloud runtime: the local CLI executes inside OpenShell.
    args = ['openhands', '--override-with-envs']
    if mode == 'script':
        path = task_file(input('Task file in /sandbox/work (for example inbox/task.md): ').strip())
        print('This task can edit files and run commands inside this sandbox.')
        if input('Run without per-action confirmation? Type RUN: ').strip() != 'RUN':
            print('Canceled; no task started.')
            return
        args += ['--headless', '--file', path, '--always-approve']
    install_session_transport(context)
    sys.argv = args
    from openhands_cli.entrypoint import main as openhands_main
    openhands_main()


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, EOFError) as error:
        print(f'OpenHands: {error}', file=sys.stderr)
        sys.exit(64)
