"""One validated HTTPS hop using Chrome's TLS/HTTP2 profile. No redirects here."""
import json
import sys
import re
from urllib.parse import urlsplit
from curl_cffi import requests, CurlOpt

request = json.load(sys.stdin)
# Node validates and pins every hop, including redirects, before invoking us.
with requests.Session(curl_options={
    CurlOpt.RESOLVE: [request['resolve']],
    CurlOpt.MAXFILESIZE_LARGE: 5_000_000,
}) as session:
    # Start on the store homepage like a normal shopping session so any
    # application cookies are present before searching the catalogue.
    parts = urlsplit(request['url'])
    if request.get('warmup'):
        session.get(f'{parts.scheme}://{parts.netloc}/', impersonate='chrome',
                    allow_redirects=False, timeout=8)
    response = session.get(request['url'], impersonate='chrome',
                           headers=request['headers'], allow_redirects=False, timeout=15)
    if len(response.content) > 5_000_000:
        raise ValueError('Store response too large')
    print(json.dumps({'status': response.status_code, 'html': response.text,
                      'diagnostic': {'server': response.headers.get('server'),
                                     'mitigated': response.headers.get('cf-mitigated'),
                                     'ray': response.headers.get('cf-ray'),
                                     'title': (re.findall(r'<title[^>]*>(.*?)</title>', response.text, re.I | re.S) or [''])[0][:140]},
                      'location': response.headers.get('location'),
                      'cookies': response.headers.get_list('set-cookie')}))
