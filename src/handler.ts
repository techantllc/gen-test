import { injectable, inject } from "inversify";

import jsonpath from "jsonpath";
import SwaggerParser from "swagger-parser";
import { APIGatewayEvent, Handler } from "aws-lambda";
import {IUtils, IRequireTestGenerator} from "./interfaces";
import {container} from "../inversify.config";
import { TYPES } from "./types";


export const parseSpec: Handler = async (event: APIGatewayEvent) => {
  const requireTestGenerator = container.get<IRequireTestGenerator>(TYPES.IRequireTestGenerator);

  const apiObject = await SwaggerParser.dereference(event);
  const paths = apiObject.paths;

  _createTestConfig(event, apiObject);

  Object.keys(paths).forEach(pathKey => {
    const path = paths[pathKey];
    Object.keys(path).forEach(key => {
      if (key === "post") {
        const jsonSchema = jsonpath.query(
          path[key],
          "$['requestBody']['content']['application/json']['schema']"
        )[0];
        console.log(`${key} ${pathKey}`);
        if (jsonSchema) {
          //console.log(JSON.stringify(jsonSchema, null, 2));
          //let template = _generatePayloadTemplate(jsonSchema.properties);
          requireTestGenerator.generateTest(pathKey, key, jsonSchema);
        }
      }
    });
  });
};

function _createTestConfig(url, apiObject) {
  const utils = container.get<IUtils>(TYPES.IUtils);
  //need to fix url splitting
  const urlArray = url.split("/");
  const rootUrl = urlArray.slice(0, 3).join("/");
  const baseUrls = apiObject.servers.map(server => {
    var absolutePattern = /^https?:\/\//i;
    if (absolutePattern.test(server.url)) {
      return server.url;
    } else {
      return rootUrl + server.url;
    }
  });

  const testConfig = {
    baseUrl: baseUrls[0]
  };

  utils.writeFileUtil(
    `./generated/node_modules/config/test-config.json`,
    JSON.stringify(testConfig, null, 2)
  );
}