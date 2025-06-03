# HeLog API

This project is a cookie-based authentication and REST API design server built with Express. Hosted on Fly.io.

The server uses Mongoose to build data models and query data and uses the MongoDB atlas database to store data.

## Links

Frontend Repositories:

1. [https://github.com/whitesgr03/helog](https://github.com/whitesgr03/helog)

2. [https://github.com/whitesgr03/helog-editor](https://github.com/whitesgr03/helog-editor)

## Technologies:

1. [Passport](https://www.passportjs.org/) uses Google and Facebook for social authentication.

2. [Mongoose](https://mongoosejs.com/) to build all data models and perform CRUD operations of account, user and post.

3. [Typescript](https://www.typescriptlang.org/) used to save considerable amounts time in validating that project have not accidentally broken.

## Additional info:

-   This project consists of a backend for API and two different front-ends for accessing and editing blog posts.

-   The backend using cookie-based authentication to prevent the need to log in again when switching between two different front-ends.

## API Endpoints

**Authentication**

```
GET /account/login/google

GET /account/oauth2/redirect/google

GET /account/login/facebook

GET /account/oauth2/redirect/facebook

POST /account/logout
```

**Blog Resource**

```
GET /blog/posts

GET /blog/posts/:postId

GET /blog/posts/:postId/comments

GET /blog/comments/:commentId/replies


POST /blog/posts

PATCH /blog/posts/:postId

DELETE /blog/posts/:postId


POST /blog/posts/:postId/comments

PATCH /blog/comments/:commentId

DELETE /blog/comments/:commentId


POST /blog/comments/:commentId/replies

POST /blog/replies/:replyId

PATCH /blog/replies/:replyId

DELETE /blog/replies/:replyId
```

**User Resource**

```
GET /user/posts

GET /posts/:postId

GET /user

POST /user

PATCH /user

DELETE /user
```
