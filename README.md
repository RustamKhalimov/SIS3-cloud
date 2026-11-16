# SIS 3 — Order Processing System

## Project Overview

This project implements an event-driven Order Processing REST API using AWS services and Infrastructure as Code.

The infrastructure is deployed using AWS CloudFormation.

## Architecture

The application consists of two ECS Fargate services:

- **API Service** — receives HTTP requests and publishes OrderCreated events to SNS.
- **Worker Service** — consumes messages from SQS and stores processed event IDs in DynamoDB.

Event flow:

API → SNS → SQS → ECS Worker → DynamoDB

Failed messages are automatically moved to a Dead-Letter Queue (DLQ) after the configured number of unsuccessful deliveries.

## AWS Services

- Amazon ECS Fargate
- Amazon ECR
- Amazon SNS
- Amazon SQS
- Amazon DynamoDB
- AWS CloudFormation
- Application Load Balancer
- Amazon CloudWatch
- AWS IAM

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | / | API information |
| GET | /health | Health check |
| POST | /orders | Create an order and publish an event |

Example POST request:

```json
{
  "orderId": "order-001",
  "customerName": "Rustam",
  "amount": 1500
}
