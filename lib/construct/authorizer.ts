import { Construct } from 'constructs';
import { aws_cognito as cognito } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib';
import { aws_lambda as lambda } from 'aws-cdk-lib';
import { aws_cloudwatch as cw } from 'aws-cdk-lib';
import { aws_cloudwatch_actions as cw_actions } from 'aws-cdk-lib';
import { aws_sns as sns } from 'aws-cdk-lib';
import { PythonLayerVersion } from '@aws-cdk/aws-lambda-python-alpha';

export interface AuthorizerConstructProps {
  alarmTopic: sns.Topic

}

export class AuthorizerConstruct extends Construct {
  public readonly userPool: cognito.UserPool
  public readonly authorizerFunction: lambda.Function;
  constructor(scope: Construct, id: string, props: AuthorizerConstructProps) {
    super(scope, id);

    const userPool = new cognito.UserPool(this, 'UserPool', {
      autoVerify: {
        email: true
      },
      signInAliases: {
        email: true,
      },
      standardAttributes: {
        fullname: {
          required: true,
          mutable: true
        },
        email: {
          required: true,
          mutable: true
        }
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      selfSignUpEnabled: true
    })
    this.userPool = userPool

    const userPoolClient = userPool.addClient('Client', {
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      generateSecret: false,
      preventUserExistenceErrors: true,
      refreshTokenValidity: cdk.Duration.days(30),
      supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.COGNITO,],
      oAuth: {
        flows: {
          authorizationCodeGrant: true
        },
        scopes: [cognito.OAuthScope.EMAIL, cognito.OAuthScope.OPENID],
        callbackUrls: ['http://localhost']
      }
    })


    userPool.addDomain('Domain', {
      cognitoDomain: {
        domainPrefix: 'mazyu36-test-aaa'
      }
    })

    const adminUserGroup = new cognito.CfnUserPoolGroup(this, 'AdminUserGroup', {
      userPoolId: userPool.userPoolId,
      groupName: 'apiAdmins',
      description: 'User group for API Administrators',
    })


    const lambdaLayer = new PythonLayerVersion(this, 'AuthorizerLayer', {
      layerVersionName: 'AuthorizerLayer',
      entry: "./lib/lambda/authorizer/layer",
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_12],
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    const authorizerFunction = new lambda.Function(this, 'AuthorizerFunction', {
      description: 'Handler for Lambda authorizer',
      handler: 'index.lambda_handler',
      code: lambda.Code.fromAsset('./lib/lambda/authorizer'),
      runtime: lambda.Runtime.PYTHON_3_12,
      environment: {
        'USER_POOL_ID': userPool.userPoolId,
        'APPLICATION_CLIENT_ID': userPoolClient.userPoolClientId,
        'ADMIN_GROUP_NAME': adminUserGroup.groupName!
      },
      timeout: cdk.Duration.seconds(100),
      tracing: lambda.Tracing.ACTIVE,
      layers: [lambdaLayer]
    })
    this.authorizerFunction = authorizerFunction



    authorizerFunction.metricErrors({
      period: cdk.Duration.minutes(1),
      statistic: cw.Stats.SUM,
    })
      .createAlarm(this, 'AuthorizerFunctionErrorsAlarm', {
        evaluationPeriods: 60,
        threshold: 1.0,
        comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        actionsEnabled: true,
      })
      .addAlarmAction(new cw_actions.SnsAction(props.alarmTopic));

    authorizerFunction.metricThrottles({
      period: cdk.Duration.minutes(1),
      statistic: cw.Stats.SUM,
    })
      .createAlarm(this, 'AuthorizerFunctionThrottlesAlarm', {
        evaluationPeriods: 60,
        threshold: 1.0,
        comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        actionsEnabled: true,
      })
      .addAlarmAction(new cw_actions.SnsAction(props.alarmTopic));

  }
}