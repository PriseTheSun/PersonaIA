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
CREATE UNIQUE INDEX "QuestionnaireOption_questionId_label_key" ON "QuestionnaireOption"("questionId", lower(btrim("label")));
CREATE INDEX "QuestionnaireOption_tenantId_questionId_idx" ON "QuestionnaireOption"("tenantId", "questionId");

CREATE FUNCTION "enforce_questionnaire_option_type"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW."tenantId" <> OLD."tenantId" OR NEW."questionId" <> OLD."questionId") THEN
    RAISE EXCEPTION 'Questionnaire option scope is immutable';
  END IF;
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

CREATE FUNCTION "enforce_questionnaire_question_scope"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."tenantId" <> OLD."tenantId" OR NEW."questionnaireId" <> OLD."questionnaireId" THEN
    RAISE EXCEPTION 'Questionnaire question scope is immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "QuestionnaireQuestion_scope_guard"
BEFORE UPDATE ON "QuestionnaireQuestion"
FOR EACH ROW EXECUTE FUNCTION "enforce_questionnaire_question_scope"();

CREATE FUNCTION "validate_questionnaire_question_options"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  affected_question_id UUID;
  affected_tenant_id UUID;
  question_type "QuestionnaireQuestionType";
  option_count INTEGER;
BEGIN
  IF TG_TABLE_NAME = 'QuestionnaireQuestion' THEN
    affected_question_id := NEW."id";
    affected_tenant_id := NEW."tenantId";
  ELSIF TG_OP = 'DELETE' THEN
    affected_question_id := OLD."questionId";
    affected_tenant_id := OLD."tenantId";
  ELSE
    affected_question_id := NEW."questionId";
    affected_tenant_id := NEW."tenantId";
  END IF;

  SELECT "type" INTO question_type
  FROM "QuestionnaireQuestion"
  WHERE "id" = affected_question_id AND "tenantId" = affected_tenant_id;

  IF NOT FOUND THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  SELECT count(*) INTO option_count
  FROM "QuestionnaireOption"
  WHERE "questionId" = affected_question_id AND "tenantId" = affected_tenant_id;

  IF question_type = 'MULTIPLE_CHOICE' AND option_count < 2 THEN
    RAISE EXCEPTION 'MULTIPLE_CHOICE questions require at least two options';
  END IF;
  IF question_type = 'FREE_TEXT' AND option_count <> 0 THEN
    RAISE EXCEPTION 'FREE_TEXT questions cannot have options';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER "QuestionnaireQuestion_options_check"
AFTER INSERT OR UPDATE ON "QuestionnaireQuestion"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "validate_questionnaire_question_options"();

CREATE CONSTRAINT TRIGGER "QuestionnaireOption_count_check"
AFTER INSERT OR UPDATE OR DELETE ON "QuestionnaireOption"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "validate_questionnaire_question_options"();
