import express, { Request, Response } from "express";
import axios from "axios";
import { baseURL, submissionsURl } from "./config";
import dotenv from "dotenv";
dotenv.config();

// Create a new express application instance
const app: express.Application = express();

// The port the express app will listen on
const port: number = process.env.PORT ? parseInt(process.env.PORT) : 3000;

interface QueryParams {
  [key: string]: string | number | boolean;
  limit: number;
  afterDate: string;
  beforeDate: string;
  offset: number;
  status: string;
  includeEditLink: boolean;
  sort: string;
}

interface DataResponse {
  responses: Array<any>;
  totalResponses: number;
  pageCount: number;
}

type FilterClauseType = {
  id: string;
  condition: "equals" | "does_not_equal" | "greater_than" | "less_than";
  value: number | string;
};

type ResponseFiltersType = FilterClauseType[];

app.get("/:formId/filteredResponses", async (req: Request, res: Response) => {
  try {
    const formId: string = req.params.formId;
    let filters: ResponseFiltersType | null;
    let filteredResponses;
    let response: DataResponse;
    const queryLimit = req.query.limit
      ? parseInt(req.query.limit as string)
      : 150;
    const queryOffset = parseInt(req.query.offset as string) || 0;
    //query parameters
    const queryParams: QueryParams = {
      limit: queryLimit,
      afterDate: req.query.afterDate ? (req.query.afterDate as string) : "",
      beforeDate: req.query.beforeDate ? (req.query.beforeDate as string) : "",
      offset: queryOffset,
      status: req.query.status ? (req.query.status as string) : "finished",
      includeEditLink:
        req.query.includeEditLink &&
        (req.query.includeEditLink as string) === "true"
          ? true
          : false,
      sort:
        req.query.sort && (req.query.sort as string) === "desc"
          ? "desc"
          : "asc",
    };

    //filters
    filters = req.query.filters
      ? JSON.parse(req.query.filters as string)
      : null;

    if (filters) {
      queryParams.limit = 150;
      response = await fetchFormData(formId, queryParams);
      filteredResponses = await getFilteredResponses(response, filters);

      //pagination
      let recordLength = filteredResponses.responses.length;

      response.totalResponses = recordLength;

      if (queryLimit != 150 && parseInt(req.query.offset as string) != 0) {
        response.responses = filteredResponses.responses.slice(
          queryOffset,
          queryOffset + queryLimit
        );
      } else {
        response = filteredResponses;
      }

      response.pageCount = Math.ceil(queryOffset / queryLimit) + 1;
    } else {
      response = await fetchFormData(formId, queryParams);
    }
    res.send(response);
  } catch (error) {
    throw new Error(`Error: ${error}`);
  }
});

async function fetchFormData(formId: string, queryParams: QueryParams) {
  try {
    let url = `${baseURL}${formId}${submissionsURl}`;

    const queryParamsString = Object.entries(queryParams)
      .filter(([_, value]) => value !== "")
      .map(([key, value]) => `${key}=${value}`)
      .join("&");

    url += `?${queryParamsString}`;

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${process.env.API_KEY}`,
      },
    });

    return response.data;
  } catch (error) {
    console.error(`Error: ${error}`);
  }
}

async function getFilteredResponses(
  response: any,
  filters: ResponseFiltersType
) {
  try {
    try {
      if (typeof filters === "string") {
        filters = JSON.parse(filters);
      }
      const filteredResponses = response.responses
        .map((response: any) => ({
          ...response,
          questions: response.questions.filter((question: any) =>
            filters.every((cond) => {
              const matchCondition = (cond: any) => {
                let booleanVal;
                switch (cond.condition) {
                  case "equals":
                    return question.id === cond.id &&
                      question.value === cond.value
                      ? true
                      : false;

                  case "does_not_equal":
                    return (
                      question.id === cond.id && question.value !== cond.value
                    );
                  case "greater_than":
                    return (
                      question.id === cond.id && question.value > cond.value
                    );
                  case "less_than":
                    return (
                      question.id === cond.id && question.value < cond.value
                    );
                  default:
                    return false; // Unsupported condition, consider it not satisfied
                }
              };

              return filters.some(matchCondition);
            })
          ),
        }))
        .filter(
          (response: any) => response.questions.length === filters.length
        );

      response.responses = filteredResponses;
      return response;
    } catch (error) {
      console.error("Error parsing filters:", error);
    }
  } catch (error) {
    throw new Error(`Error: ${error}`);
  }
}

// Serve the application at the given port
app.listen(port, () => {
  console.log(`App is listening on port ${port}`);
});
