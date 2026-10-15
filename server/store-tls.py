"""One validated HTTPS hop using Chrome's TLS/HTTP2 profile. No redirects here."""
import json
import sys
from curl_cffi import requests, CurlOpt

request = json.load(sys.stdin)
# Node validates and pins every hop, including redirects, before invoking us.
with requests.Session(curl_options={
    CurlOpt.RESOLVE: [request['resolve']],
    CurlOpt.MAXFILESIZE_LARGE: 5_000_000,
}) as session:
    response = session.get(request['url'], impersonate='chrome',
                           headers=request['headers'], allow_redirects=False, timeout=15)
    if len(response.content) > 5_000_000:
        raise ValueError('Store response too large')
    print(json.dumps({'status': response.status_code, 'html': response.text,
                      'location': response.headers.get('location'),
                      'cookies': response.headers.get_list('set-cookie')}))
