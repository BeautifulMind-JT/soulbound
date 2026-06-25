import {
  createApplicant,
  deleteFixtureUsers,
  readIntegrationConfig,
  uniqueSuffix,
  type TestSession,
} from "./_integration/fixtures";
import { POST as postApplication } from "./admission/applications/route";
import { GET as getMyApplication } from "./admission/applications/me/route";
import { GET as getApplicationById } from "./admission/applications/[id]/route";
import { GET as getMyMembership } from "./membership/me/route";

function authedRequest(
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Request {
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${accessToken}`);

  return new Request(`http://localhost${path}`, {
    ...init,
    headers,
  });
}

async function submitApplication(
  accessToken: string,
  body: Record<string, unknown>,
): Promise<Response> {
  return postApplication(authedRequest(accessToken, "/api/admission/applications", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
    },
  }));
}

describe("applicant route handlers", () => {
  const fixtureUsers: TestSession[] = [];

  afterEach(async () => {
    if (fixtureUsers.length === 0) {
      return;
    }

    try {
      await deleteFixtureUsers(readIntegrationConfig(), fixtureUsers);
    } finally {
      fixtureUsers.length = 0;
    }
  });

  it("handles applicant submit/read/membership routes with real bearer auth", async () => {
    const config = readIntegrationConfig();
    const applicant = await createApplicant(config, "task6a-owner");
    fixtureUsers.push(applicant);
    const otherApplicant = await createApplicant(config, "task6a-other");
    fixtureUsers.push(otherApplicant);

    const maliciousSubmitResponse = await submitApplication(
      applicant.accessToken,
      {
        applicantId: otherApplicant.id,
        applicantStatement: "Task 6a applicant statement.",
        motivation: "Prove route handlers with real auth.",
        idempotencyKey: `task6a-submit-${uniqueSuffix()}`,
      },
    );
    expect(maliciousSubmitResponse.status).toBe(201);
    const application = await maliciousSubmitResponse.json();
    expect(application.status).toBe("submitted");
    expect(application.applicantId).toBe(applicant.id);
    expect(application.applicantId).not.toBe(otherApplicant.id);

    const meResponse = await getMyApplication(
      authedRequest(applicant.accessToken, "/api/admission/applications/me"),
    );
    expect(meResponse.status).toBe(200);
    const activeApplication = await meResponse.json();
    expect(activeApplication.id).toBe(application.id);
    expect(activeApplication).not.toHaveProperty("applicantEmail");
    expect(activeApplication).not.toHaveProperty("reviewerEmail");
    expect(activeApplication).not.toHaveProperty("email");
    expect(activeApplication).not.toHaveProperty("reviewSummary");

    const ownResponse = await getApplicationById(
      authedRequest(
        applicant.accessToken,
        `/api/admission/applications/${application.id}`,
      ),
      { params: Promise.resolve({ id: application.id }) },
    );
    expect(ownResponse.status).toBe(200);
    await expect(ownResponse.json()).resolves.toMatchObject({
      id: application.id,
      applicantId: applicant.id,
    });

    const otherSubmitResponse = await submitApplication(
      otherApplicant.accessToken,
      {
        motivation: "Other applicant application.",
        idempotencyKey: `task6a-other-submit-${uniqueSuffix()}`,
      },
    );
    expect(otherSubmitResponse.status).toBe(201);
    const otherApplication = await otherSubmitResponse.json();

    const otherReadResponse = await getApplicationById(
      authedRequest(
        applicant.accessToken,
        `/api/admission/applications/${otherApplication.id}`,
      ),
      { params: Promise.resolve({ id: otherApplication.id }) },
    );
    expect(otherReadResponse.status).toBe(404);

    const membershipResponse = await getMyMembership(
      authedRequest(applicant.accessToken, "/api/membership/me"),
    );
    expect(membershipResponse.status).toBe(200);
    await expect(membershipResponse.json()).resolves.toBeNull();
  });

  it("returns 401 for missing or invalid sessions", async () => {
    const noSessionResponse = await postApplication(
      new Request("http://localhost/api/admission/applications", {
        method: "POST",
        body: JSON.stringify({
          motivation: "No auth.",
          idempotencyKey: "no-auth",
        }),
      }),
    );
    expect(noSessionResponse.status).toBe(401);

    const invalidSessionResponse = await getMyApplication(
      authedRequest("not-a-real-token", "/api/admission/applications/me"),
    );
    expect(invalidSessionResponse.status).toBe(401);
  });
});
