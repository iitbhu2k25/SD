import multiprocessing
workers = multiprocessing.cpu_count()
threads = 2
bind = "0.0.0.0:7000"
worker_class = "uvicorn.workers.UvicornWorker"
timeout = 1200
keepalive = 30
max_requests = 1000
max_requests_jitter = 100
loglevel = "debug"