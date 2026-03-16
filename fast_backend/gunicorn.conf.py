import multiprocessing
workers = multiprocessing.cpu_count()
threads = 1
bind = "0.0.0.0:7000"
worker_class = "uvicorn.workers.UvicornWorker"
timeout = 120
keepalive = 30
loglevel = "info"
max_requests = 1000
max_requests_jitter = 100