import { Construct } from 'constructs';
import { aws_sns as sns } from 'aws-cdk-lib';
import { aws_iam as iam } from 'aws-cdk-lib';

export interface ObserveConstructProps {

}

export class ObserveConstruct extends Construct {
  public readonly alarmTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: ObserveConstructProps) {
    super(scope, id);

    const topic = new sns.Topic(this, 'AlarmTopic');
    new sns.Subscription(this, 'EmailSubsc', {
      endpoint: 'yiyth.fcb6@gmail.com',
      protocol: sns.SubscriptionProtocol.EMAIL,
      topic: topic,
    });
    this.alarmTopic = topic;

    topic.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('cloudwatch.amazonaws.com')],
        actions: ['sns:Publish'],
        resources: [topic.topicArn],
      }),
    );
  }
}