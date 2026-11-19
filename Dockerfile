FROM python:3.12-slim
WORKDIR /app
COPY vs_market_data.py global_market.py cross_asset.py engine_v3.py test_engine_v3.py ./
COPY vendor/artheras/ /app/vendor/artheras/
ENV PYTHONUNBUFFERED=1
RUN python -m unittest -q test_engine_v3
CMD ["sh","-c","python -u vs_market_data.py & python -u global_market.py & python -u cross_asset.py & python -u engine_v3.py & wait"]
