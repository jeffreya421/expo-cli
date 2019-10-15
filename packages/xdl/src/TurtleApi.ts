import { JSONObject, JSONValue } from '@expo/json-file';
import axios, { AxiosRequestConfig } from 'axios';
import ExtendableError from 'es6-error';
import idx from 'idx';
import merge from 'lodash/merge';
import QueryString from 'querystring';

import TurtleConfig from './TurtleConfig';


// These aren't constants because some commands switch between staging and prod
function _rootBaseUrl() {
  return `${TurtleConfig.api.scheme}://${TurtleConfig.api.host}`;
}

function _apiBaseUrl() {
  let rootBaseUrl = _rootBaseUrl();
  if (TurtleConfig.api.port) {
    rootBaseUrl += ':' + TurtleConfig.api.port;
  }
  return rootBaseUrl;
}

export class TurtleApiError extends ExtendableError {
  code: string;
  details?: JSONValue;
  serverStack?: string;
  readonly _isApiError = true;

  constructor(message: string, code: string = 'UNKNOWN') {
    super(message);
    this.code = code;
  }
}

type RequestOptions = {
  httpMethod: 'get' | 'post' | 'put' | 'delete';
  queryParameters?: QueryParameters;
  body?: JSONObject;
};

export interface ProjectConfig {
  data: Buffer;
  headers: JSONObject;
}

type QueryParameters = { [key: string]: string | number | boolean | null | undefined };

type TurtleApiClientOptions = {
  sessionSecret?: string;
};

export default class TurtleApiClient {
  static exponentClient: string = 'xdl';
  sessionSecret: string | null = null;

  static clientForUser(user?: TurtleApiClientOptions | null): TurtleApiClient {
    // TODO add auth token
    if (user && user.sessionSecret) {
      return new TurtleApiClient({ sessionSecret: user.sessionSecret });
    }
    return new TurtleApiClient({
      sessionSecret: JSON.stringify(
        {
          "userId": "85689f36-f570-459d-aca0-97e0e271283c",
          "username": "turtle-v2-api-test-user"
        }),
    });
  }

  static setClientName(name: string) {
    TurtleApiClient.exponentClient = name;
  }

  constructor(options: TurtleApiClientOptions = {}) {
    if (options.sessionSecret) {
      this.sessionSecret = options.sessionSecret;
    }
  }

  async getAsync(
    methodName: string,
    args: QueryParameters = {},
    extraOptions?: Partial<RequestOptions>,
    returnEntireResponse: boolean = false
  ) {
    return this._requestAsync(
      methodName,
      {
        httpMethod: 'get',
        queryParameters: args,
      },
      extraOptions,
      returnEntireResponse
    );
  }

  async postAsync(
    methodName: string,
    data?: JSONObject,
    extraOptions?: Partial<RequestOptions>,
    returnEntireResponse: boolean = false
  ) {
    return this._requestAsync(
      methodName,
      {
        httpMethod: 'post',
        body: data,
      },
      extraOptions,
      returnEntireResponse
    );
  }

  async putAsync(
    methodName: string,
    data: JSONObject,
    extraOptions?: Partial<RequestOptions>,
    returnEntireResponse: boolean = false
  ) {
    return this._requestAsync(
      methodName,
      {
        httpMethod: 'put',
        body: data,
      },
      extraOptions,
      returnEntireResponse
    );
  }

  async deleteAsync(
    methodName: string,
    extraOptions?: Partial<RequestOptions>,
    returnEntireResponse: boolean = false
  ) {
    return this._requestAsync(
      methodName,
      {
        httpMethod: 'delete',
      },
      extraOptions,
      returnEntireResponse
    );
  }

  async _requestAsync(
    methodName: string,
    options: RequestOptions,
    extraRequestOptions?: Partial<RequestOptions>,
    returnEntireResponse: boolean = false,
  ) {
    const url = `${_apiBaseUrl()}/${methodName}`;
    let reqOptions: AxiosRequestConfig = {
      url,
      method: options.httpMethod,
      headers: {
        'fake-auth': null,
      },
    };

    if (this.sessionSecret) {
      reqOptions.headers['fake-auth'] = this.sessionSecret;
    }

    // Handle qs
    if (options.queryParameters) {
      reqOptions.params = options.queryParameters;
      reqOptions.paramsSerializer = QueryString.stringify;
    }

    // Handle body
    if (options.body) {
      reqOptions.data = options.body;
    }

    reqOptions = merge({}, reqOptions, extraRequestOptions);
    let response;
    let result;
    try {
      response = await axios.request(reqOptions);
      result = response.data;
    } catch (e) {
      const maybeErrorData = idx(e, _ => _.response.data.errors.length);
      if (maybeErrorData) {
        result = e.response.data;
      } else {
        throw e;
      }
    }

    if (result.errors && result.errors.length) {
      let responseError = result.errors[0];
      let error = new TurtleApiError(responseError.message, responseError.code);
      error.serverStack = responseError.stack;
      error.details = responseError.details;
      throw error;
    }

    return returnEntireResponse ? response : result;
  }

  async uploadFile(config: ProjectConfig) {
    const url = `${_apiBaseUrl()}/upload`;

    let reqOptions: AxiosRequestConfig = {
      method: 'post',
      url,
      data: config.data,
      headers: config.headers,
    }

    if (this.sessionSecret) {
      reqOptions.headers['fake-auth'] = this.sessionSecret;
    }

    let response;
    let result;
    try {
      response = await axios.request(reqOptions);
      result = response;
    } catch (e) {
      const maybeErrorData = idx(e, _ => _.response.data.errors.length);
      if (maybeErrorData) {
        result = e.response.data;
      } else {
        throw e;
      }
    }

    if (result.errors && result.errors.length) {
      let responseError = result.errors[0];
      let error = new TurtleApiError(responseError.message, responseError.code);
      error.serverStack = responseError.stack;
      error.details = responseError.details;
      throw error;
    }

    return result.data;
  }


}
