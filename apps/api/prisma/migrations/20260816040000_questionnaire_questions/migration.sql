CREATE TYPE "QuestionnaireQuestionType" AS ENUM ('MULTIPLE_CHOICE', 'FREE_TEXT');

CREATE TABLE "QuestionnaireQuestion" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "questionnaireId" UUID NOT NULL,
  "prompt" VARCHAR(1000) NOT NULL,
  "type" "QuestionnaireQuestionType" NOT NULL,
  "position" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "QuestionnaireQuestion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "QuestionnaireQuestion_prompt_check" CHECK (char_length(btrim("prompt")) BETWEEN 1 AND 1000),
  CONSTRAINT "QuestionnaireQuestion_position_check" CHECK ("position" >= 0),
  CONSTRAINT "QuestionnaireQuestion_questionnaire_fkey"
    FOREIGN KEY ("questionnaireId", "tenantId") REFERENCES "Questionnaire"("id", "tenantId")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "QuestionnaireQuestion_id_tenantId_key" ON "QuestionnaireQuestion"("id", "tenantId");
CREATE UNIQUE INDEX "QuestionnaireQuestion_questionnaireId_position_key" ON "QuestionnaireQuestion"("questionnaireId", "position");
CREATE INDEX "QuestionnaireQuestion_tenantId_questionnaireId_idx" ON "QuestionnaireQuestion"("tenantId", "questionnaireId");

CREATE TABLE "QuestionnaireOption" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "questionId" UUID NOT NULL,
  "label" VARCHAR(300) NOT NULL,
  "position" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "QuestionnaireOption_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "QuestionnaireOption_label_check" CHECK (char_length(btrim("label")) BETWEEN 1 AND 300),
  CONSTRAINT "QuestionnaireOption_position_check" CHECK ("position" >= 0),
  CONSTRAINT "QuestionnaireOption_question_fkey"
    FOREIGN KEY ("questionId", "tenantId") REFERENCES "QuestionnaireQuestion"("id", "tenantId")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "QuestionnaireOption_questionId_position_key" ON "QuestionnaireOption"("questionId", "position");
CREATE INDEX "QuestionnaireOption_tenantId_questionId_idx" ON "QuestionnaireOption"("tenantId", "questionId");

CREATE FUNCTION "enforce_questionnaire_option_type"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "QuestionnaireQuestion"
    WHERE "id" = NEW."questionId"
      AND "tenantId" = NEW."tenantId"
      AND "type" = 'MULTIPLE_CHOICE'
  ) THEN
    RAISE EXCEPTION 'Questionnaire options require a MULTIPLE_CHOICE question';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "QuestionnaireOption_type_guard"
BEFORE INSERT OR UPDATE ON "QuestionnaireOption"
FOR EACH ROW EXECUTE FUNCTION "enforce_questionnaire_option_type"();
