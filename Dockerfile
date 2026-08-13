FROM golang:1.22-alpine AS builder

WORKDIR /app
COPY cloud/ .
RUN go mod download
RUN CGO_ENABLED=0 GOOS=linux go build -o /shellius-cloud ./cmd/server

FROM alpine:3.20
RUN apk --no-cache add ca-certificates
COPY --from=builder /shellius-cloud /usr/local/bin/shellius-cloud

EXPOSE 8080
CMD ["shellius-cloud"]
