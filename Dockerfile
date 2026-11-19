FROM python:3.12-slim
WORKDIR /app
COPY vs_market_data.py .
ENV PYTHONUNBUFFERED=1
CMD ["python","vs_market_data.py"]
