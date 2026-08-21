import unittest
from unittest.mock import patch, MagicMock
import os
import json

from ai_pipeline.engine.gemini_insights import generate_recruiter_insights, answer_followup_question

class TestGeminiIntegration(unittest.TestCase):
    def setUp(self):
        self.candidate = {"name": "Test User", "skills": ["Java", "Python"]}
        self.job_profile = {"required_skills": ["Java"], "preferred_skills": [], "minimum_experience_years": 2}
        self.score_result = {"overall_score": 85, "required_skill_fit": 100, "preferred_skill_fit": 0, "experience_fit": 100, "required_results": [{"skill": "Java", "status": "MATCH", "evidence": "Used Java"}]}
        os.environ["GEMINI_API_KEY"] = "fake-key"
        os.environ["GEMINI_FALLBACK_MODELS"] = "primary-model,fallback-model"
    
    @patch('google.genai.Client')
    def test_a_valid_request(self, MockClient):
        # TEST A — Valid Gemini request
        mock_client_instance = MockClient.return_value
        mock_response = MagicMock()
        mock_response.text = json.dumps({
            "candidate_summary": "Summary",
            "key_strengths": ["Java"],
            "skill_gaps": [],
            "experience_relevance": "Good",
            "potential_concerns": [],
            "interview_focus_areas": ["Java"],
            "match_quality_explanation": "Great"
        })
        mock_client_instance.models.generate_content.return_value = mock_response

        res = generate_recruiter_insights(self.candidate, self.job_profile, self.score_result)
        self.assertEqual(res["status"], "ok")
        self.assertEqual(res["candidate_summary"], "Summary")
        self.assertEqual(res["key_strengths"], ["Java"])

    def test_b_missing_key(self):
        # TEST B — Missing API key
        if "GEMINI_API_KEY" in os.environ:
            del os.environ["GEMINI_API_KEY"]
        res = generate_recruiter_insights(self.candidate, self.job_profile, self.score_result)
        self.assertEqual(res["status"], "unavailable")
        self.assertIn("not set", res["reason"])

    @patch('google.genai.Client')
    def test_c_invalid_key(self, MockClient):
        # TEST C — Invalid API key
        class AuthError(Exception):
            code = 401
        mock_client_instance = MockClient.return_value
        mock_client_instance.models.generate_content.side_effect = AuthError("API key not valid")
        
        res = generate_recruiter_insights(self.candidate, self.job_profile, self.score_result)
        self.assertEqual(res["status"], "unavailable")
        self.assertNotIn("API key not valid", res["reason"])  # Must not leak secret or raw details
        self.assertEqual(mock_client_instance.models.generate_content.call_count, 1) # Only tries once

    @patch('google.genai.Client')
    def test_d_primary_model_returns_503(self, MockClient):
        # TEST D — Primary model returns 503
        class ServerError(Exception):
            code = 503
        mock_client_instance = MockClient.return_value
        mock_response = MagicMock()
        mock_response.text = json.dumps({"candidate_summary": "Summary", "key_strengths": [], "skill_gaps": [], "experience_relevance": "", "potential_concerns": [], "interview_focus_areas": [], "match_quality_explanation": ""})
        mock_client_instance.models.generate_content.side_effect = [ServerError("503"), mock_response]
        
        res = generate_recruiter_insights(self.candidate, self.job_profile, self.score_result)
        self.assertEqual(res["status"], "ok")
        self.assertEqual(mock_client_instance.models.generate_content.call_count, 2)
        # Verify fallback model was called
        calls = mock_client_instance.models.generate_content.call_args_list
        self.assertEqual(calls[0][1]['model'], 'primary-model')
        self.assertEqual(calls[1][1]['model'], 'fallback-model')

    @patch('google.genai.Client')
    @patch('time.sleep', return_value=None)
    def test_e_primary_model_returns_429(self, mock_sleep, MockClient):
        # TEST E — Primary model returns 429
        class RateLimitError(Exception):
            code = 429
        mock_client_instance = MockClient.return_value
        mock_response = MagicMock()
        mock_response.text = json.dumps({"candidate_summary": "Summary", "key_strengths": [], "skill_gaps": [], "experience_relevance": "", "potential_concerns": [], "interview_focus_areas": [], "match_quality_explanation": ""})
        # 429 once, then success on same model
        mock_client_instance.models.generate_content.side_effect = [RateLimitError("429"), mock_response]
        
        res = generate_recruiter_insights(self.candidate, self.job_profile, self.score_result)
        self.assertEqual(res["status"], "ok")
        mock_sleep.assert_called_once()
        calls = mock_client_instance.models.generate_content.call_args_list
        self.assertEqual(calls[0][1]['model'], 'primary-model')
        self.assertEqual(calls[1][1]['model'], 'primary-model')

    @patch('google.genai.Client')
    def test_f_all_models_fail(self, MockClient):
        # TEST F — All models fail
        class ServerError(Exception):
            code = 500
        mock_client_instance = MockClient.return_value
        mock_client_instance.models.generate_content.side_effect = ServerError("500")
        
        res = generate_recruiter_insights(self.candidate, self.job_profile, self.score_result)
        self.assertEqual(res["status"], "unavailable")

    @patch('google.genai.Client')
    def test_g_malformed_json(self, MockClient):
        # TEST G — Malformed model JSON
        mock_client_instance = MockClient.return_value
        mock_response = MagicMock()
        mock_response.text = "{ malformed json"
        mock_client_instance.models.generate_content.return_value = mock_response

        res = generate_recruiter_insights(self.candidate, self.job_profile, self.score_result)
        self.assertEqual(res["status"], "unavailable")
        self.assertIn("unparseable JSON", res["reason"])

    @patch('google.genai.Client')
    def test_h_followup_question(self, MockClient):
        # TEST H — Follow-up question
        mock_client_instance = MockClient.return_value
        mock_response = MagicMock()
        mock_response.text = "This candidate is great."
        mock_client_instance.models.generate_content.return_value = mock_response

        res = answer_followup_question(self.candidate, self.job_profile, self.score_result, [], "Why?")
        self.assertEqual(res["status"], "ok")
        self.assertEqual(res["answer"], "This candidate is great.")

    @patch('google.genai.Client')
    def test_i_conversation_context(self, MockClient):
        # TEST I — Conversation context
        mock_client_instance = MockClient.return_value
        mock_response = MagicMock()
        mock_response.text = "Answer to weakness"
        mock_client_instance.models.generate_content.return_value = mock_response

        conversation = [
            {"role": "user", "content": "Why is this candidate suitable?"},
            {"role": "model", "content": "They know Java."}
        ]
        res = answer_followup_question(self.candidate, self.job_profile, self.score_result, conversation, "What are his weaknesses?")
        self.assertEqual(res["status"], "ok")
        
        # Verify conversation is passed
        args = mock_client_instance.models.generate_content.call_args[1]
        contents = args['contents']
        # The prompt builder adds 2 initial instructions, plus 2 from history, plus 1 for the new question = 5
        self.assertEqual(len(contents), 5)
        self.assertEqual(contents[4].parts[0].text, "What are his weaknesses?")

if __name__ == '__main__':
    unittest.main()
