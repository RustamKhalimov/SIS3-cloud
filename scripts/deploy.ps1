
param(
    [string]$Region = "eu-central-1",
    [string]$FoundationStackName = "sis3-foundation",
    [string]$AppStackName = "sis3-app"
)

$ErrorActionPreference = "Stop"

function Check-Command {
    param([string]$Name)

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "$Name is not installed or is not available in PATH."
    }
}

function Test-StackExists {
    param([string]$StackName)

    aws cloudformation describe-stacks `
        --stack-name $StackName `
        --region $Region 2>$null | Out-Null

    return ($LASTEXITCODE -eq 0)
}

# Check required tools
Check-Command "aws"
Check-Command "docker"

Write-Host "Starting SIS3 deployment..." -ForegroundColor Cyan

# 1. Deploy Foundation Stack if it does not exist
if (-not (Test-StackExists $FoundationStackName)) {
    Write-Host "Creating Foundation Stack..."

    aws cloudformation deploy `
        --template-file "infra/foundation.yaml" `
        --stack-name $FoundationStackName `
        --region $Region `
        --capabilities CAPABILITY_IAM

    if ($LASTEXITCODE -ne 0) {
        throw "Foundation Stack deployment failed."
    }
}
else {
    Write-Host "Foundation Stack already exists. Skipping creation."
}

# 2. Get AWS account ID
$AccountId = aws sts get-caller-identity `
    --query Account `
    --output text `
    --region $Region

if ($LASTEXITCODE -ne 0 -or -not $AccountId) {
    throw "Could not retrieve AWS account ID."
}

# 3. Get ECR repository URI
$RepositoryUri = aws cloudformation describe-stacks `
    --stack-name $FoundationStackName `
    --region $Region `
    --query "Stacks[0].Outputs[?OutputKey=='OrdersRepositoryUri'].OutputValue | [0]" `
    --output text

if ($LASTEXITCODE -ne 0 -or -not $RepositoryUri -or $RepositoryUri -eq "None") {
    throw "Could not retrieve ECR repository URI."
}

# 4. Generate unique immutable image tag
$ImageTag = "build-$(Get-Date -Format 'yyyyMMddHHmmss')"

Write-Host "Building Docker image: $ImageTag"

docker build -t "sis3-orders-api:$ImageTag" .

if ($LASTEXITCODE -ne 0) {
    throw "Docker image build failed."
}

# 5. Authenticate with Amazon ECR
Write-Host "Authenticating with Amazon ECR..."

$EcrPassword = aws ecr get-login-password --region $Region

if ($LASTEXITCODE -ne 0 -or -not $EcrPassword) {
    throw "Could not retrieve ECR password."
}

$EcrPassword | docker login `
    --username AWS `
    --password-stdin "$AccountId.dkr.ecr.$Region.amazonaws.com"

if ($LASTEXITCODE -ne 0) {
    throw "ECR login failed."
}

# 6. Tag and push Docker image
Write-Host "Pushing Docker image to ECR..."

docker tag "sis3-orders-api:$ImageTag" "${RepositoryUri}:$ImageTag"

if ($LASTEXITCODE -ne 0) {
    throw "Docker image tagging failed."
}

docker push "${RepositoryUri}:$ImageTag"

if ($LASTEXITCODE -ne 0) {
    throw "Docker image push failed."
}

# 7. Deploy Application Stack
Write-Host "Deploying Application Stack..."

aws cloudformation deploy `
    --template-file "infra/app.yaml" `
    --stack-name $AppStackName `
    --region $Region `
    --capabilities CAPABILITY_IAM `
    --parameter-overrides `
        Environment=dev `
        FoundationStackName=$FoundationStackName `
        ImageTag=$ImageTag

if ($LASTEXITCODE -ne 0) {
    throw "Application Stack deployment failed."
}

Write-Host "SIS3 deployment completed successfully!" -ForegroundColor Green
Write-Host "Image tag: $ImageTag"
