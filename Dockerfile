FROM python:3.12-slim
WORKDIR /app
COPY vs_market_data.py global_market.py ./
ENV PYTHONUNBUFFERED=1
CMD ["sh","-c","python -u vs_market_data.py & python -u global_market.py & wait"]
