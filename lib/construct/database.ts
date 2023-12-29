import { Construct } from 'constructs';
import { aws_dynamodb as dynamodb } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib';

export interface DatabaseConstructProps {

}

export class DatabaseConstruct extends Construct {
  public readonly usersTable: dynamodb.Table
  public readonly ordersTable: dynamodb.Table
  public readonly idempotencyTable: dynamodb.Table

  constructor(scope: Construct, id: string, props: DatabaseConstructProps) {
    super(scope, id);

    const usersTable = new dynamodb.Table(this, 'UserTable', {
      partitionKey: {
        name: 'userid',
        type: dynamodb.AttributeType.STRING
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    })
    this.usersTable = usersTable


    const ordersTable = new dynamodb.Table(this, 'OrderTable', {
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'orderId',
        type: dynamodb.AttributeType.STRING
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    })
    this.ordersTable = ordersTable


    const idempotencyTable = new dynamodb.Table(this, 'IdempotencyTable', {
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'expiration',
      removalPolicy: cdk.RemovalPolicy.DESTROY
    })
    this.idempotencyTable = idempotencyTable
  }
}