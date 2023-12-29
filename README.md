# Serverless Patterns


[WorkShopのリンク](https://catalog.workshops.aws/serverless-patterns/en-US)。`M2 - Synchronous Invocation`と`M3 - Synchronous + Idempotence`の2つを実装。

## アーキテクチャ
![](architecture.drawio.svg)

大きくは2種類のAPIを構築している。

### `/users`
* ユーザー情報を管理するAPI
* バックエンドのLambda関数は単一かつモノリス構成（1つの関数の中でメソッド等で分岐させている）。
* 認証はカスタムオーソライザーでCognitoのIDトークンを検証している。

### `/orders`
* 注文の管理を行うAPI
* APIごとにLambda関数を分割している。
* 認証はCognitoオーソライザーを使用している。
* `create_table`のみLambda Powertoolsを使用し、冪等性の確保やログ拡張、メトリクス拡張を行なっている。


# APIを叩く方法

## 事前準備
CognitoにサインインしてIDトークンを取得する

```sh
aws cognito-idp initiate-auth --auth-flow USER_PASSWORD_AUTH --client-id COGNITO_CLIET_ID --auth-parameters USERNAME=YOUR_USERNAME,PASSWORD=YOUR_PASSWORD
```

## users
IDトークンをAuthorizationヘッダに付与してAPIを叩く

```sh
# 特定のユーザー情報を取得
curl https://USERS_API_ENDPOINT/Prod/users/YOUR_USER_NAME  -H "Authorization:ID_TOKEN"

# ユーザーに関するデータを更新
curl --location --request PUT 'https://USERS_API_ENDPOINT/Prod/users/YOUR_USER_NAME' \
--data-raw '{"name": "My name is hogehoge"}' \
--header "Authorization: ID_TOKEN" \
--header "Content-Type: application/json" \

# ユーザーのリストを取得
curl https://USERS_API_ENDPOINT/Prod/users  -H "Authorization:ID_TOKEN"
```

## orders

```sh
# 注文の実施
curl --location --request POST 'https://ORDERS_API_ENDPOINT/Prod/orders' \
--data-raw '{"restaurantId":1,"orderId": "hogehoge","orderItems":[{"id":1,"name":"Spaghetti","price":9.99,"quantity":1},{"id":2,"name":"Pizza - SMALL","price":4.99,"quantity":2}],"totalAmount":19.97}' \
--header "Authorization:ID_TOKEN" \

# 注文の一覧を取得
curl https://ORDERS_API_ENDPOINT/Prod/orders  -H "Authorization:ID_TOKEN"

# 特定の注文の情報を取得
curl https://ORDERS_API_ENDPOINT/Prod/orders/hogehoge  -H "Authorization:ID_TOKEN"

# 注文の修正
curl --location --request PUT 'https://ORDERS_API_ENDPOINT/Prod/orders/hogehoge' \
--data-raw '{"restaurantId":1,"orderId": "hogehoge","orderItems":[{"id":1,"name":"Spaghetti","price":9.99,"quantity":1},{"id":2,"name":"Pizza - SMALL","price":4.99,"quantity":2},{"id":3,"name":"Salad - LARGE","price":9.99,"quantity":1}
],"totalAmount":19.97}' \
--header "Authorization:ID_TOKEN" \

# 注文の削除
curl --location --request DELETE 'https://ORDERS_API_ENDPOINT/Prod/orders/hogehoge' \
--header "Authorization:ID_TOKEN" \
```