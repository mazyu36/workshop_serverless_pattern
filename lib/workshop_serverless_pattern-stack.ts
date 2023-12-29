import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DatabaseConstruct } from './construct/database';
import { UsersApi } from './construct/users-api';
import { AuthorizerConstruct } from './construct/authorizer';
import { ObserveConstruct } from './construct/observe';
import { OrdersApi } from './construct/orders-api';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class WorkshopServerlessPatternStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const observe = new ObserveConstruct(this, 'ObserveConstruct', {})

    const database = new DatabaseConstruct(this, 'DatabaseConstruct', {})


    const authorizer = new AuthorizerConstruct(this, 'AuthorizerConstruct', {
      alarmTopic: observe.alarmTopic

    })

    new UsersApi(this, 'UsersApi', {
      usersTable: database.usersTable,
      authorizerFunction: authorizer.authorizerFunction,
      alarmTopic: observe.alarmTopic
    })

    new OrdersApi(this, 'OrdersApi', {
      ordersTable: database.ordersTable,
      idempotencyTable: database.idempotencyTable,
      userPool: authorizer.userPool,
      alarmTopic: observe.alarmTopic
    })
  }
}
