"""Fixed, image-owned entrypoint for OpenHands CLI and headless task files.

Executed with isolated Python by the native launcher. No upstream secret or
trace identity is persisted in the workspace or OpenHands settings.
"""
import json
import os
from pathlib import Path
import re
import sys
from urllib.parse import urlparse

WORKSPACE = Path('/sandbox/work')


def normalize_gateway_url(url_str):
    if not url_str or not str(url_str).strip():
        return 'http://136.112.93.84:8787'
    raw = str(url_str).strip()
    if not (raw.startswith('http://') or raw.startswith('https://')):
        raw = 'http://' + raw
    parsed = urlparse(raw)
    host = parsed.hostname or ''
    if host not in ('136.112.93.84', 'host.openshell.internal', '127.0.0.1', 'localhost', '136.123.45.67'):
        raise ValueError(f"OpenShell network policy blocks arbitrary gateway host '{host}'. Only '136.112.93.84' and 'host.openshell.internal' are authorized.")
    path = parsed.path
    for suffix in ('/v1/chat/completions', '/chat/completions', '/v1/messages/count_tokens', '/v1/messages', '/v1'):
        if path.endswith(suffix):
            path = path[:-len(suffix)]
            break
    path = path.rstrip('/')
    return f"{parsed.scheme}://{parsed.netloc}{path}"


BASE_URL = normalize_gateway_url(os.environ.get('HALOOP_GATEWAY_URL') or os.environ.get('LLM_BASE_URL') or 'http://136.112.93.84:8787')
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


def install_session_transport(context, base_url=None):
    # The pinned OpenHands SDK uses HTTPX for both streaming and ordinary
    # provider calls. Add the per-process assertion only at the fixed edge;
    # never put it in agent_settings.json or forward it to another origin.
    import httpx
    send = httpx.Client.send
    async_send = httpx.AsyncClient.send

    target_url = base_url or BASE_URL
    parsed_base = urlparse(target_url)
    target_host = parsed_base.hostname
    target_port = parsed_base.port

    def scoped(request):
        request.headers.pop('x-openrind-haloop-session', None)
        request.headers.pop('x-w8-haloop-provider', None)
        request.headers.pop('x-w8-haloop-metadata', None)
        request.headers.pop('x-w8-haloop-config', None)
        url = request.url
        if url.scheme in ('http', 'https'):
            host_match = (
                url.host in ('136.112.93.84', 'host.openshell.internal')
                or (target_host and url.host == target_host)
            )
            port_match = (
                url.port == (target_port or 8787)
                or (target_port is None and url.port in (8787, 80, 443))
            )
            path_match = url.path in ('/v1/messages', '/v1/messages/count_tokens', '/v1/chat/completions', '/chat/completions')
            if host_match and port_match and path_match:
                request.headers['x-openrind-haloop-session'] = context
                if url.host == '136.112.93.84' or target_host == '136.112.93.84':
                    provider = os.environ.get('W8_HALOOP_PROVIDER') or os.environ.get('OPENRIND_GATEWAY_PROVIDER') or 'openrouter'
                    request.headers.setdefault('x-w8-haloop-provider', provider)
                    project = os.environ.get('W8_PROJECT') or os.environ.get('OPENRIND_SHELL_PROJECT') or os.environ.get('OPENRIND_SHELL_WORKSPACE_ID') or 'openhands'
                    request.headers.setdefault('x-w8-haloop-metadata', json.dumps({"project": project}))
                    collector_url = os.environ.get('W8_COLLECTOR_URL') or 'http://collector:8788'
                    haloop_config = {
                        "input_guardrails": [{"halo.mark": {"collectorURL": collector_url}, "async": False, "deny": False}],
                        "output_guardrails": [{"halo.export": {"collectorURL": collector_url, "defaultProject": project}, "async": False, "deny": False}],
                    }
                    request.headers.setdefault('x-w8-haloop-config', json.dumps(haloop_config))
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
    base = normalize_gateway_url(os.environ.get('HALOOP_GATEWAY_URL') or os.environ.get('LLM_BASE_URL') or BASE_URL)
    openai_base = f"{base}/v1" if not base.endswith('/v1') else base
    model = os.environ.get('OPENRIND_SHELL_OPENHANDS_MODEL') or 'openai/openrouter/free'
    os.chdir(WORKSPACE)
    os.environ.update({
        'HOME': '/sandbox/openhands-home',
        'LLM_MODEL': model,
        'LLM_BASE_URL': openai_base,
        'LLM_API_KEY': credential,
        'OPENAI_API_KEY': credential,
        'ANTHROPIC_API_KEY': credential,
        'ANTHROPIC_BASE_URL': base,
        'ANTHROPIC_API_BASE': base,
        'OPENAI_BASE_URL': openai_base,
        'OPENAI_API_BASE': openai_base,
        'LITELLM_API_BASE': openai_base,
        'ANTHROPIC_CUSTOM_HEADERS': f'x-openrind-haloop-session: {context}',
        'DO_NOT_TRACK': '1',
        'LITELLM_LOCAL_MODEL_COST_MAP': 'True',
        'LITELLM_MODE': 'PRODUCTION',
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
    install_session_transport(context, base)
    sys.argv = args
    from openhands_cli.entrypoint import main as openhands_main
    openhands_main()


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, EOFError) as error:
        print(f'OpenHands: {error}', file=sys.stderr)
        sys.exit(64)
