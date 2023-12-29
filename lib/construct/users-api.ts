import { Construct } from 'constructs';
import { aws_dynamodb as dynamodb } from 'aws-cdk-lib';
import { aws_lambda as lambda } from 'aws-cdk-lib';
import { aws_apigateway as apigateway } from 'aws-cdk-lib';
import { aws_logs as logs } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib';
import { aws_cloudwatch as cw } from 'aws-cdk-lib';
import { aws_cloudwatch_actions as cw_actions } from 'aws-cdk-lib';
import { aws_sns as sns } from 'aws-cdk-lib';

export interface UsersApiProps {
  usersTable: dynamodb.Table,
  authorizerFunction: lambda.Function,
  alarmTopic: sns.Topic
}

export class UsersApi extends Construct {
  constructor(scope: Construct, id: string, props: UsersApiProps) {
    super(scope, id);

    const usersFunction = new lambda.Function(this, 'UserFunction', {
      description: 'Handler for all users related operations',
      handler: 'index.lambda_handler',
      code: lambda.Code.fromAsset('./lib/lambda/users/'),
      runtime: lambda.Runtime.PYTHON_3_12,
      environment: {
        'USERS_TABLE': props.usersTable.tableName
      },
      timeout: cdk.Duration.seconds(100),
      tracing: lambda.Tracing.ACTIVE
    })

    props.usersTable.grantReadWriteData(usersFunction)


    usersFunction.metricErrors({
      period: cdk.Duration.minutes(1),
      statistic: cw.Stats.SUM,
    })
      .createAlarm(this, 'UsersFunctionErrorsAlarm', {
        evaluationPeriods: 60,
        threshold: 1.0,
        comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        actionsEnabled: true,
      })
      .addAlarmAction(new cw_actions.SnsAction(props.alarmTopic));

    usersFunction.metricThrottles({
      period: cdk.Duration.minutes(1),
      statistic: cw.Stats.SUM,
    })
      .createAlarm(this, 'UsersFunctionThrottlesAlarm', {
        evaluationPeriods: 60,
        threshold: 1.0,
        comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        actionsEnabled: true,
      })
      .addAlarmAction(new cw_actions.SnsAction(props.alarmTopic));



    const lambdaAuthorizer = new apigateway.TokenAuthorizer(this, 'TokenAuthorizer', {
      handler: props.authorizerFunction,
      identitySource: apigateway.IdentitySource.header('Authorization'),
    })

    const logGroup = new logs.LogGroup(this, 'AccessLogs', {
      logGroupClass: logs.LogGroupClass.INFREQUENT_ACCESS,
      retention: logs.RetentionDays.ONE_DAY,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    })

    // API Gateway
    const usersApi = new apigateway.LambdaRestApi(this, 'UsersRestApi', {
      handler: usersFunction,
      deployOptions: {
        stageName: 'Prod',
        tracingEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        accessLogDestination: new apigateway.LogGroupLogDestination(logGroup),
        accessLogFormat: apigateway.AccessLogFormat.custom('{ "requestId":"$context.requestId", "ip": "$context.identity.sourceIp", "requestTime":"$context.requestTime", "httpMethod":"$context.httpMethod","routeKey":"$context.routeKey", "status":"$context.status","protocol":"$context.protocol", "integrationStatus": $context.integrationStatus, "integrationLatency": $context.integrationLatency, "responseLength":"$context.responseLength" }')
      },
      proxy: false,
      defaultMethodOptions: {
        authorizer: lambdaAuthorizer
      },
    })

    const users = usersApi.root.addResource('users')
    users.addMethod('GET')
    users.addMethod('POST')

    const usersWithUserid = users.addResource('{userid}')
    usersWithUserid.addMethod('GET')
    usersWithUserid.addMethod('PUT')
    usersWithUserid.addMethod('DELETE')


    usersApi.metricServerError({
      period: cdk.Duration.minutes(1),
      statistic: cw.Stats.SUM,
    })
      .createAlarm(this, 'APIGateway5xxErrorCount', {
        evaluationPeriods: 1,
        threshold: 1,
        comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        actionsEnabled: true,
      })
      .addAlarmAction(new cw_actions.SnsAction(props.alarmTopic));



    new cdk.CfnOutput(this, 'UsersApiEndpoint', {
      value: usersApi.url
    })
  }
}