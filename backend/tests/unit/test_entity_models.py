"""Tests for Phase 2 entity Pydantic models."""

from datetime import UTC, datetime
from uuid import uuid4

import pytest
from pydantic import ValidationError

from backend.models.agent import AgentCreate, AgentFilter, AgentResponse, AgentUpdate
from backend.models.building import (
    BuildingCreate,
    BuildingFilter,
    BuildingUpdate,
)
from backend.models.campaign import CampaignCreate, CampaignResponse
from backend.models.chat import (
    ConversationCreate,
    MessageCreate,
    MessageResponse,
)
from backend.models.event import EventCreate, EventFilter, EventUpdate
from backend.models.member import MemberCreate, MemberUpdate

# --- Agent Models ---


class TestAgentCreate:
    def test_valid_create(self):
        agent = AgentCreate(name="Karl Müller", system="government", gender="male")
        assert agent.name == "Karl Müller"
        assert agent.system == "government"
        assert agent.gender == "male"
        assert agent.data_source == "manual"

    def test_defaults(self):
        agent = AgentCreate(name="Min Agent")
        assert agent.system is None
        assert agent.character is None
        assert agent.background is None
        assert agent.gender is None
        assert agent.primary_profession is None
        assert agent.data_source == "manual"

    def test_empty_name_raises(self):
        with pytest.raises(ValidationError):
            AgentCreate(name="")

    def test_long_name_raises(self):
        with pytest.raises(ValidationError):
            AgentCreate(name="A" * 256)


class TestAgentUpdate:
    def test_partial_update(self):
        update = AgentUpdate(name="Updated Name")
        assert update.name == "Updated Name"
        assert update.system is None

    def test_all_none(self):
        update = AgentUpdate()
        assert update.name is None


class TestAgentResponse:
    def test_valid_response(self):
        now = datetime.now(UTC)
        resp = AgentResponse(
            id=uuid4(),
            simulation_id=uuid4(),
            name="Agent X",
            created_at=now,
            updated_at=now,
        )
        assert resp.name == "Agent X"
        assert resp.deleted_at is None


class TestAgentFilter:
    def test_all_none(self):
        f = AgentFilter()
        assert f.system is None
        assert f.gender is None
        assert f.search is None

    def test_with_values(self):
        f = AgentFilter(system="rebel", gender="female", search="test")
        assert f.system == "rebel"
        assert f.gender == "female"
        assert f.search == "test"


# --- Building Models ---


class TestBuildingCreate:
    def test_valid_create(self):
        b = BuildingCreate(name="Rathaus", building_type="government")
        assert b.name == "Rathaus"
        assert b.building_type == "government"
        assert b.population_capacity == 0
        assert b.data_source == "manual"

    def test_empty_name_raises(self):
        with pytest.raises(ValidationError):
            BuildingCreate(name="", building_type="residential")

    def test_negative_capacity_raises(self):
        with pytest.raises(ValidationError):
            BuildingCreate(name="Bad", building_type="x", population_capacity=-1)


class TestBuildingUpdate:
    def test_partial_update(self):
        update = BuildingUpdate(building_condition="good")
        assert update.building_condition == "good"
        assert update.name is None


class TestBuildingFilter:
    def test_with_type(self):
        f = BuildingFilter(building_type="residential")
        assert f.building_type == "residential"


# --- Event Models ---


class TestEventCreate:
    def test_valid_create(self):
        e = EventCreate(title="Revolution Day", event_type="political", impact_level=8)
        assert e.title == "Revolution Day"
        assert e.impact_level == 8
        assert e.tags == []

    def test_with_tags(self):
        e = EventCreate(title="Test", tags=["urgent", "political"])
        assert len(e.tags) == 2

    def test_empty_title_raises(self):
        with pytest.raises(ValidationError):
            EventCreate(title="")

    def test_impact_out_of_range(self):
        with pytest.raises(ValidationError):
            EventCreate(title="Boom", impact_level=11)

        with pytest.raises(ValidationError):
            EventCreate(title="Boom", impact_level=0)


class TestEventUpdate:
    def test_partial_update(self):
        u = EventUpdate(impact_level=5)
        assert u.impact_level == 5
        assert u.title is None


class TestEventFilter:
    def test_with_values(self):
        f = EventFilter(event_type="natural", tag="flood")
        assert f.event_type == "natural"
        assert f.tag == "flood"


# --- Chat Models ---


class TestConversationCreate:
    def test_valid(self):
        c = ConversationCreate(agent_id=uuid4())
        assert c.title is None

    def test_with_title(self):
        c = ConversationCreate(agent_id=uuid4(), title="Test Chat")
        assert c.title == "Test Chat"


class TestMessageCreate:
    def test_valid(self):
        m = MessageCreate(content="Hello there!")
        assert m.sender_role == "user"

    def test_empty_content_raises(self):
        with pytest.raises(ValidationError):
            MessageCreate(content="")

    def test_long_content_raises(self):
        with pytest.raises(ValidationError):
            MessageCreate(content="X" * 10001)


class TestMessageResponse:
    def test_valid(self):
        now = datetime.now(UTC)
        m = MessageResponse(
            id=uuid4(),
            conversation_id=uuid4(),
            sender_role="assistant",
            content="Hi!",
            created_at=now,
        )
        assert m.sender_role == "assistant"


# --- Member Models ---


class TestMemberCreate:
    def test_valid(self):
        m = MemberCreate(user_id=uuid4(), member_role="editor")
        assert m.member_role == "editor"

    def test_default_role(self):
        m = MemberCreate(user_id=uuid4())
        assert m.member_role == "viewer"

    def test_invalid_role_raises(self):
        with pytest.raises(ValidationError):
            MemberCreate(user_id=uuid4(), member_role="superadmin")


class TestMemberUpdate:
    def test_valid(self):
        m = MemberUpdate(member_role="admin")
        assert m.member_role == "admin"

    def test_owner_allowed(self):
        m = MemberUpdate(member_role="owner")
        assert m.member_role == "owner"

    def test_invalid_role_raises(self):
        with pytest.raises(ValidationError):
            MemberUpdate(member_role="god")


# --- Campaign Models ---


class TestCampaignCreate:
    def test_valid(self):
        c = CampaignCreate(title="Propaganda Push")
        assert c.title == "Propaganda Push"
        assert c.description is None


class TestCampaignResponse:
    def test_valid(self):
        now = datetime.now(UTC)
        c = CampaignResponse(
            id=uuid4(),
            simulation_id=uuid4(),
            title="Campaign X",
            is_integrated_as_event=False,
            created_at=now,
            updated_at=now,
        )
        assert c.title == "Campaign X"
