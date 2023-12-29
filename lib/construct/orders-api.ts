import { Construct } from 'constructs';
import { aws_dynamodb as dynamodb } from 'aws-cdk-lib';
import { aws_lambda as lambda } from 'aws-cdk-lib';
import { aws_apigateway as apigateway } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib';
import { aws_sns as sns } from 'aws-cdk-lib';
import { aws_cognito as cognito } from 'aws-cdk-lib';
import { PythonLayerVersion } from '@aws-cdk/aws-lambda-python-alpha';

export interface OrdersApiProps {
  ordersTable: dynamodb.Table,
  idempotencyTable: dynamodb.Table
  userPool: cognito.UserPool,
  alarmTopic: sns.Topic
}

export class OrdersApi extends Construct {
  constructor(scope: Construct, id: string, props: OrdersApiProps) {
    super(scope, id);

    // Layer
    const lambdaPowertools = lambda.LayerVersion.fromLayerVersionArn(
      this,
      'lambda-powertools',
      `arn:aws:lambda:${cdk.Stack.of(this).region}:017000801446:layer:AWSLambdaPowertoolsPythonV2:58`,
    );

    const lambdaLayer = new PythonLayerVersion(this, 'UtilLayer', {
      layerVersionName: 'UtilLayer',
      entry: "./lib/lambda/layers",
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_12],
      removalPolicy: cdk.RemovalPolicy.DESTROY
    })

    // Create Orders
    const createOrdersFunction = new lambda.Function(this, 'OrdersFunction', {
      handler: 'index.lambda_handler',
      code: lambda.Code.fromAsset('./lib/lambda/create_orders/'),
      runtime: lambda.Runtime.PYTHON_3_12,
      environment: {
        'TABLE_NAME': props.ordersTable.tableName,
        'IDEMPOTENCY_TABLE_NAME': props.idempotencyTable.tableName,
        'POWERTOOLS_SERVICE_NAME': 'orders',
        'POWERTOOLS_METRICS_NAMESPACE': 'ServerlessWorkshop'
      },
      timeout: cdk.Duration.seconds(100),
      tracing: lambda.Tracing.ACTIVE,
      layers: [lambdaPowertools]
    })

    props.ordersTable.grantWriteData(createOrdersFunction)
    props.idempotencyTable.grantReadWriteData(createOrdersFunction)


    // List Orders
    const listOrdersFunction = new lambda.Function(this, 'ListOrdersFunction', {
      handler: 'index.lambda_handler',
      code: lambda.Code.fromAsset('./lib/lambda/list_orders'),
      runtime: lambda.Runtime.PYTHON_3_12,
      environment: {
        'TABLE_NAME': props.ordersTable.tableName

      },
      timeout: cdk.Duration.seconds(100),
      tracing: lambda.Tracing.ACTIVE,
      layers: [lambdaLayer]
    })

    props.ordersTable.grantReadData(listOrdersFunction)


    // Get Orders
    const getOrderFunction = new lambda.Function(this, 'GetOrderFunction', {
      handler: 'index.lambda_handler',
      code: lambda.Code.fromAsset('./lib/lambda/get_order'),
      runtime: lambda.Runtime.PYTHON_3_12,
      environment: {
        'TABLE_NAME': props.ordersTable.tableName
      },
      timeout: cdk.Duration.seconds(100),
      tracing: lambda.Tracing.ACTIVE,
      layers: [lambdaLayer]
    })

    props.ordersTable.grantReadData(getOrderFunction)


    // Edit Order
    const editOrderFunction = new lambda.Function(this, 'EditOrderFunction', {
      handler: 'index.lambda_handler',
      code: lambda.Code.fromAsset('./lib/lambda/edit_order'),
      runtime: lambda.Runtime.PYTHON_3_12,
      environment: {
        'TABLE_NAME': props.ordersTable.tableName

      },
      timeout: cdk.Duration.seconds(100),
      tracing: lambda.Tracing.ACTIVE,
      layers: [lambdaLayer]
    })

    props.ordersTable.grantReadWriteData(editOrderFunction)


    // Cancel Order
    const cancelOrderFunction = new lambda.Function(this, 'CancelOrderFunction', {
      handler: 'index.lambda_handler',
      code: lambda.Code.fromAsset('./lib/lambda/cancel_order'),
      runtime: lambda.Runtime.PYTHON_3_12,
      environment: {
        'TABLE_NAME': props.ordersTable.tableName

      },
      timeout: cdk.Duration.seconds(100),
      tracing: lambda.Tracing.ACTIVE,
      layers: [lambdaLayer]
    })

    props.ordersTable.grantReadWriteData(cancelOrderFunction)


    // API Gateway
    const cognitoAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [props.userPool]
    })

    const ordersApi = new apigateway.RestApi(this, 'OrdersRestApi', {
      deployOptions: {
        stageName: 'Prod',
        tracingEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
      },
      defaultMethodOptions: {
        authorizer: cognitoAuthorizer
      },
    })

    const orders = ordersApi.root.addResource('orders')
    orders.addMethod("POST", new apigateway.LambdaIntegration(createOrdersFunction), {
      authorizationType: apigateway.AuthorizationType.COGNITO
    })

    orders.addMethod("GET", new apigateway.LambdaIntegration(listOrdersFunction), {
      authorizationType: apigateway.AuthorizationType.COGNITO
    })


    const ordersWithOrderId = orders.addResource('{orderId}')
    ordersWithOrderId.addMethod("GET", new apigateway.LambdaIntegration(getOrderFunction), {
      authorizationType: apigateway.AuthorizationType.COGNITO
    })

    ordersWithOrderId.addMethod("PUT", new apigateway.LambdaIntegration(editOrderFunction), {
      authorizationType: apigateway.AuthorizationType.COGNITO
    })

    ordersWithOrderId.addMethod("DELETE", new apigateway.LambdaIntegration(cancelOrderFunction), {
      authorizationType: apigateway.AuthorizationType.COGNITO
    })






  }
}